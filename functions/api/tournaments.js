export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(`
    SELECT id, name, description, status, created_at
    FROM tournaments
    ORDER BY id DESC
  `).all();
  return Response.json(results);
}
