export async function onRequestGet({ request, env }) {
  const id = Number(new URL(request.url).searchParams.get("tournament_id"));
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });

  const { results } = await env.DB
    .prepare(`
      SELECT id, tournament_id, name, created_at
      FROM competitors
      WHERE tournament_id = ?
      ORDER BY id
    `)
    .bind(id)
    .all();

  return Response.json(results);
}
