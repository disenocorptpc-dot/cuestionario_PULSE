export async function onRequestGet({ env }) {
  try {
    if (!env.DB) {
      return new Response('Database not bound', { status: 500 });
    }

    const { results } = await env.DB.prepare(`
      SELECT * FROM weekly_pulse_responses 
      ORDER BY submitted_at DESC
    `).all();

    const headers = [
      "ID", "Fecha_Semana", "Diseñador", "Equipo", "Proyecto_Estrella", 
      "Valor_Aportado", "Tiempo_Proyecto", "Ejemplos_Rutina", "Tiempo_Rutina", 
      "Tiene_Incidencia", "Causa_Incidencia", "Descripcion_Incidencia", 
      "Impacto_Costo", "Innovacion_Mejora", "Timestamp_Envio"
    ];

    const rows = (results || []).map(r => [
      `"${r.id || ''}"`,
      `"${r.week_date || ''}"`,
      `"${r.designer || ''}"`,
      `"${r.team_unit || ''}"`,
      `"${(r.star_project || '').replace(/"/g, '""')}"`,
      `"${(r.star_value || '').replace(/"/g, '""')}"`,
      `"${r.star_time || ''}"`,
      `"${(r.routine_tasks || '').replace(/"/g, '""')}"`,
      `"${r.routine_time || ''}"`,
      `"${r.has_incident || ''}"`,
      `"${r.incident_cause || ''}"`,
      `"${(r.incident_description || '').replace(/"/g, '""')}"`,
      `"${r.cost_impact || ''}"`,
      `"${(r.innovation_notes || '').replace(/"/g, '""')}"`,
      `"${r.submitted_at || ''}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Weekly_Pulse_D1_Export_${new Date().toISOString().slice(0,10)}.csv"`,
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response('Error exporting CSV: ' + err.message, { status: 500 });
  }
}
