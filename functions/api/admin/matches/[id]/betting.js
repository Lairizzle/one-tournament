import { requireAdmin } from "../../../../../lib/auth.js";

export async function onRequestPost({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Match ID is required" }, { status: 400 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof body.open !== "boolean") return Response.json({ error: "open must be true or false" }, { status: 400 });

  const match = await env.DB.prepare(`
    SELECT m.id, m.status, m.betting_open, m.competitor_a_id, m.competitor_b_id, r.tournament_id
    FROM matches m JOIN rounds r ON r.id = m.round_id WHERE m.id = ?
  `).bind(id).first();
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  if (!match.competitor_a_id || !match.competitor_b_id) return Response.json({ error: "Match does not have two competitors" }, { status: 400 });
  if (match.status === "completed") return Response.json({ error: "Match is completed" }, { status: 400 });

  if (body.open) {
    const tournament = await env.DB.prepare(`SELECT status FROM tournaments WHERE id = ?`).bind(match.tournament_id).first();
    if (!tournament || !["betting", "in_progress"].includes(tournament.status)) {
      return Response.json({ error: "Tournament must be in betting or in_progress status" }, { status: 400 });
    }
  }

  const updated = await env.DB.prepare(`
    UPDATE matches SET betting_open = ? WHERE id = ?
    RETURNING id, round_id, match_number, competitor_a_id, competitor_b_id, winner_id, status, betting_open
  `).bind(body.open ? 1 : 0, id).first();
  return Response.json(updated);
}
