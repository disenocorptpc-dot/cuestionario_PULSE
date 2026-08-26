export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    
    const id = data.id || ('rec_' + Date.now());
    const submittedAt = data.submittedAt || new Date().toISOString();
    const weekDate = data.weekDate || submittedAt.slice(0, 10);
    const designer = data.designer || 'Anónimo';
    const teamUnit = data.teamUnit || 'Diseño Gráfico';
    const starProject = data.starProject || 'Operación regular';
    const starValue = data.starValue || '';
    const starTime = data.starTime || '';
    const routineTasks = data.routineTasks || '';
    const routineTime = data.routineTime || '';
    const hasIncident = data.hasIncident || 'No';
    const incidentCause = data.incidentCause || 'N/A';
    const incidentDescription = data.incidentDescription || 'N/A';
    const costImpact = data.costImpact || 'No aplica';
    const innovationNotes = data.innovationNotes || 'N/A';

    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO weekly_pulse_responses (
          id, week_date, designer, team_unit, star_project, star_value, star_time,
          routine_tasks, routine_time, has_incident, incident_cause,
          incident_description, cost_impact, innovation_notes, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, weekDate, designer, teamUnit, starProject, starValue, starTime,
        routineTasks, routineTime, hasIncident, incidentCause,
        incidentDescription, costImpact, innovationNotes, submittedAt
      ).run();
    }

    return new Response(JSON.stringify({ success: true, id: id }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
