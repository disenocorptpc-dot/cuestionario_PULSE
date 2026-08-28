/**
 * GET /api/responses — Weekly Pulse v2
 *
 * Parámetros opcionales:
 *   ?month=2026-09   filtra por mes de la semana reportada
 *   ?designer=homero filtra por designer_id
 *   ?limit=200
 */
export async function onRequestGet({ request, env }) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  };

  if (!env.DB) {
    return new Response(
      JSON.stringify({ success: false, error: "Base de datos no vinculada (binding DB ausente)." }),
      { status: 500, headers }
    );
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const designer = url.searchParams.get("designer");
  let limit = parseInt(url.searchParams.get("limit") || "300", 10);
  if (!Number.isFinite(limit) || limit < 1 || limit > 1000) limit = 300;

  const where = [];
  const binds = [];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    where.push("substr(week_start, 1, 7) = ?");
    binds.push(month);
  }
  if (designer) {
    where.push("designer_id = ?");
    binds.push(designer);
  }

  const sql =
    "SELECT * FROM weekly_pulse_v2 " +
    (where.length ? "WHERE " + where.join(" AND ") + " " : "") +
    "ORDER BY week_start DESC, designer ASC LIMIT ?";
  binds.push(limit);

  try {
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return new Response(
      JSON.stringify({ success: true, count: (results || []).length, data: results || [] }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers }
    );
  }
}
