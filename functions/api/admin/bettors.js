import { requireAdmin } from "../../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(new URL(request.url).searchParams.get("tournament_id"));
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });
  const { results } = await env.DB.prepare(`SELECT id, tournament_id, name, created_at FROM bettors WHERE tournament_id = ? ORDER BY name COLLATE NOCASE, id`).bind(id).all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const tournamentId = Number(body.tournament_id);
  const name = body.name?.trim();
  if (!tournamentId || !name) return Response.json({ error: "Tournament ID and bettor name are required" }, { status: 400 });
  const tournament = await env.DB.prepare(`SELECT id FROM tournaments WHERE id = ?`).bind(tournamentId).first();
  if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });
  const bettor = await env.DB.prepare(`INSERT INTO bettors (tournament_id, name) VALUES (?, ?) RETURNING id, tournament_id, name, created_at`).bind(tournamentId, name).first();
  return Response.json(bettor, { status: 201 });
}
