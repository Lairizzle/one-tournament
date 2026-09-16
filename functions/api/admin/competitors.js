import { requireAdmin } from "../../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tournamentId = Number(body.tournament_id);
  const name = body.name?.trim();

  if (!tournamentId || !name) {
    return Response.json({ error: "Tournament ID and competitor name are required" }, { status: 400 });
  }

  const tournament = await env.DB
    .prepare(`SELECT id, status FROM tournaments WHERE id = ?`)
    .bind(tournamentId)
    .first();

  if (!tournament) {
    return Response.json({ error: "Tournament not found" }, { status: 404 });
  }

  if (tournament.status !== "setup") {
    return Response.json({ error: "Competitors can only be changed during setup" }, { status: 400 });
  }

  const competitor = await env.DB
    .prepare(`
      INSERT INTO competitors (tournament_id, name)
      VALUES (?, ?)
      RETURNING id, tournament_id, name, created_at
    `)
    .bind(tournamentId, name)
    .first();

  return Response.json(competitor, { status: 201 });
}
