export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });
  const tournament = await env.DB.prepare(`SELECT id, name, description, status, created_at FROM tournaments WHERE id = ?`).bind(id).first();
  if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });
  return Response.json(tournament);
}
