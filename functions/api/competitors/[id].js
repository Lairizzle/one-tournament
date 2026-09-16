export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Competitor ID is required" }, { status: 400 });

  const competitor = await env.DB
    .prepare(`SELECT id, tournament_id, name, created_at FROM competitors WHERE id = ?`)
    .bind(id)
    .first();

  if (!competitor) return Response.json({ error: "Competitor not found" }, { status: 404 });

  return Response.json(competitor);
}
