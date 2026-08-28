/**
 * POST /api/submit — Weekly Pulse v2
 *
 * Diferencias de fondo respecto a v1:
 *  1. Valida en servidor. Si el payload no cierra o le falta identidad,
 *     responde 400 y el cliente muestra error real (antes se guardaba basura).
 *  2. Números como números. Nada de rangos en texto.
 *  3. UPSERT por (designer_id, week_iso): reenviar la misma semana reemplaza,
 *     no duplica.
 *  4. Nunca inventa relleno silencioso. Si falta un dato obligatorio, falla.
 */

const NUM_FIELDS = [
  "hours_available", "hours_value", "hours_standard", "hours_projects",
  "hours_operation", "hours_coordination", "hours_rework", "hours_other",
  "hours_assigned"
];

const json = (obj, status) => new Response(JSON.stringify(obj), {
  status: status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  }
});

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch (_) {
    return json({ success: false, error: "Cuerpo inválido: se esperaba JSON." }, 400);
  }

  // ── Validación de identidad y periodo ──
  const problems = [];
  if (!data.designer_id) problems.push("designer_id");
  if (!data.designer)    problems.push("designer");
  if (!/^\d{4}-W\d{2}$/.test(data.week_iso || "")) problems.push("week_iso");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.week_start || "")) problems.push("week_start");
  if (problems.length) {
    return json({ success: false, error: "Campos faltantes o inválidos: " + problems.join(", ") }, 400);
  }

  // ── Normalización numérica ──
  const n = {};
  NUM_FIELDS.forEach(f => { n[f] = toNum(data[f]); });

  if (!(n.hours_available > 0)) {
    return json({ success: false, error: "hours_available debe ser mayor a 0." }, 400);
  }

  // ── Invariante de cierre: las horas deben cuadrar ──
  const sum = n.hours_value + n.hours_standard + n.hours_operation +
              n.hours_coordination + n.hours_rework + n.hours_other;
  if (Math.abs(sum - n.hours_available) > 0.51) {
    return json({
      success: false,
      error: "El reparto de horas no cuadra: " + sum + " asignadas contra " +
             n.hours_available + " disponibles."
    }, 400);
  }

  // ── Detalle de proyectos ──
  let projects = [];
  try {
    projects = JSON.parse(data.projects_json || "[]");
    if (!Array.isArray(projects)) projects = [];
  } catch (_) {
    return json({ success: false, error: "projects_json no es JSON válido." }, 400);
  }

  const record = {
    id: data.id || ("rec_" + Date.now()),
    submitted_at: data.submitted_at || new Date().toISOString(),
    schema_version: 2,

    week_iso: data.week_iso,
    week_start: data.week_start,
    week_number: toNum(data.week_number),
    week_year: toNum(data.week_year),
    designer: String(data.designer),
    designer_id: String(data.designer_id),
    designer_role: data.designer_role || "",
    team_unit: data.team_unit || "",

    hours_available:    n.hours_available,
    hours_value:        n.hours_value,
    hours_standard:     n.hours_standard,
    hours_projects:     n.hours_value + n.hours_standard,
    hours_operation:    n.hours_operation,
    hours_coordination: n.hours_coordination,
    hours_rework:       n.hours_rework,
    hours_other:        n.hours_other,
    hours_assigned:     sum,

    project_count: projects.length,
    projects_json: JSON.stringify(projects),

    has_rework:         n.hours_rework > 0 ? "Sí" : "No",
    rework_cause:       n.hours_rework > 0 ? (data.rework_cause || "") : "",
    rework_description: n.hours_rework > 0 ? (data.rework_description || "") : "",
    cost_impact:        n.hours_rework > 0 ? (data.cost_impact || "") : "",
    cost_amount_mxn:    (n.hours_rework > 0 && data.cost_amount_mxn != null)
                          ? toNum(data.cost_amount_mxn) : null,

    innovation_notes: data.innovation_notes || "",
    blockers:         data.blockers || ""
  };

  // Si hay retrabajo, la causa es obligatoria: es el dato que da valor al reporte.
  if (record.has_rework === "Sí" && !record.rework_cause) {
    return json({ success: false, error: "Hay horas de retrabajo pero no se indicó la causa." }, 400);
  }

  if (!env.DB) {
    return json({ success: false, error: "Base de datos no vinculada (binding DB ausente)." }, 500);
  }

  const cols = Object.keys(record);
  const placeholders = cols.map(() => "?").join(", ");
  // Al reenviar la misma semana, se sobreescribe todo excepto la clave natural.
  const updates = cols
    .filter(c => c !== "designer_id" && c !== "week_iso")
    .map(c => c + " = excluded." + c)
    .join(", ");

  try {
    await env.DB.prepare(
      "INSERT INTO weekly_pulse_v2 (" + cols.join(", ") + ") VALUES (" + placeholders + ") " +
      "ON CONFLICT (designer_id, week_iso) DO UPDATE SET " + updates
    ).bind(...cols.map(c => record[c])).run();
  } catch (err) {
    return json({ success: false, error: "Error de base de datos: " + err.message }, 500);
  }

  return json({
    success: true,
    id: record.id,
    week_iso: record.week_iso,
    designer: record.designer
  }, 200);
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
