/**
 * GET /api/export-csv — Weekly Pulse v2
 *
 * Parámetros:
 *   ?month=2026-09        filtra por mes de la semana reportada
 *   ?level=semana         (default) una fila por persona × semana
 *   ?level=proyectos      una fila por proyecto — es la vista que responde
 *                         directo al "tiempo aproximado por proyecto" que
 *                         pidió Gerencia
 */

/* Escapado CSV correcto: comillas dobladas y campo siempre entrecomillado. */
function q(v) {
  if (v == null) return '""';
  return '"' + String(v).replace(/"/g, '""') + '"';
}
function pct(part, whole) {
  const p = Number(part), w = Number(whole);
  if (!Number.isFinite(p) || !Number.isFinite(w) || w === 0) return "";
  return (Math.round(p / w * 1000) / 10).toString();
}

const WEEK_HEADERS = [
  "Semana_ISO", "Semana_Inicio", "Anio", "Num_Semana",
  "Disenador", "Rol", "Equipo",
  "Horas_Disponibles", "Horas_Valor", "Pct_Valor", "Horas_Estandar",
  "Horas_Operacion", "Pct_Operacion", "Horas_Coordinacion",
  "Horas_Retrabajo", "Pct_Retrabajo", "Horas_Otro",
  "Horas_Asignadas", "Descuadre",
  "Num_Proyectos", "Proyectos",
  "Tiene_Retrabajo", "Causa_Retrabajo", "Descripcion_Retrabajo",
  "Impacto_Costo", "Costo_MXN",
  "Innovacion", "Bloqueos",
  "Enviado_En", "ID"
];

const PROJECT_HEADERS = [
  "Semana_ISO", "Semana_Inicio", "Disenador",
  "Proyecto", "Horas", "Pct_De_La_Semana", "Tipo", "Aportacion"
];

function parseProjects(raw) {
  try {
    const p = JSON.parse(raw || "[]");
    return Array.isArray(p) ? p : [];
  } catch (_) {
    return [];
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return new Response("Base de datos no vinculada (binding DB ausente).", { status: 500 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const level = (url.searchParams.get("level") || "semana").toLowerCase();

  const where = [];
  const binds = [];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    where.push("substr(week_start, 1, 7) = ?");
    binds.push(month);
  }

  let results;
  try {
    const stmt = env.DB.prepare(
      "SELECT * FROM weekly_pulse_v2 " +
      (where.length ? "WHERE " + where.join(" AND ") + " " : "") +
      "ORDER BY week_start DESC, designer ASC"
    );
    const out = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    results = out.results || [];
  } catch (err) {
    return new Response("Error al exportar: " + err.message, { status: 500 });
  }

  let headers, rows;

  if (level === "proyectos") {
    headers = PROJECT_HEADERS;
    rows = [];
    results.forEach(r => {
      const projects = parseProjects(r.projects_json);
      if (!projects.length) {
        rows.push([
          q(r.week_iso), q(r.week_start), q(r.designer),
          q("(sin proyecto — semana de operación)"),
          q(r.hours_operation), q(pct(r.hours_operation, r.hours_available)),
          q("operacion"), q("")
        ]);
        return;
      }
      projects.forEach(p => {
        rows.push([
          q(r.week_iso), q(r.week_start), q(r.designer),
          q(p.name), q(p.hours), q(pct(p.hours, r.hours_available)),
          q(p.kind === "valor" ? "aporto algo nuevo" : "ejecucion estandar"),
          q(p.contribution || "")
        ]);
      });
    });
  } else {
    headers = WEEK_HEADERS;
    rows = results.map(r => {
      const projects = parseProjects(r.projects_json);
      const projLabel = projects.length
        ? projects.map(p => p.name + " (" + p.hours + " h, " +
            (p.kind === "valor" ? "valor" : "estándar") + ")").join(" | ")
        : "Operación, sin proyecto propio";
      const descuadre = Math.round((Number(r.hours_assigned) - Number(r.hours_available)) * 10) / 10;
      return [
        q(r.week_iso), q(r.week_start), q(r.week_year), q(r.week_number),
        q(r.designer), q(r.designer_role), q(r.team_unit),
        q(r.hours_available), q(r.hours_value), q(pct(r.hours_value, r.hours_available)),
        q(r.hours_standard),
        q(r.hours_operation), q(pct(r.hours_operation, r.hours_available)),
        q(r.hours_coordination),
        q(r.hours_rework), q(pct(r.hours_rework, r.hours_available)),
        q(r.hours_other),
        q(r.hours_assigned), q(descuadre),
        q(r.project_count), q(projLabel),
        q(r.has_rework), q(r.rework_cause), q(r.rework_description),
        q(r.cost_impact), q(r.cost_amount_mxn),
        q(r.innovation_notes), q(r.blockers),
        q(r.submitted_at), q(r.id)
      ];
    });
  }

  // BOM (﻿) para que Excel en Windows lea los acentos correctamente.
  // CRLF por la misma razón. Ojo: escribir el carácter BOM literal en el
  // fuente es frágil (los editores lo normalizan); siempre usar el escape.
  const csv = "\uFEFF" + [headers.map(q).join(","), ...rows.map(r => r.join(","))].join("\r\n");

  const stamp = month || new Date().toISOString().slice(0, 10);
  const name = "Weekly_Pulse_" + level + "_" + stamp + ".csv";

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + name + '"',
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}
