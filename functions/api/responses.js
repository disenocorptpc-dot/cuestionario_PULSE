export async function onRequestGet({ env }) {
  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not bound' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { results } = await env.DB.prepare(`
      SELECT * FROM weekly_pulse_responses 
      ORDER BY submitted_at DESC 
      LIMIT 200
    `).all();

    return new Response(JSON.stringify({ success: true, data: results }), {
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
