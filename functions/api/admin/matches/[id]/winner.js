import { requireAdmin } from "../../../../../lib/auth.js";
import { advanceWinner } from "../../../../../lib/bracket.js";

export async function onRequestPost({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Match ID is required" }, { status: 400 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const winnerId = Number(body.winner_id);
  if (!winnerId) return Response.json({ error: "Winner ID is required" }, { status: 400 });

  const match = await env.DB.prepare(`
    SELECT m.id, m.round_id, m.match_number, m.competitor_a_id, m.competitor_b_id, m.winner_id, m.status, m.betting_open,
           r.tournament_id, r.round_number
    FROM matches m JOIN rounds r ON r.id = m.round_id WHERE m.id = ?
  `).bind(id).first();
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  if (winnerId !== Number(match.competitor_a_id) && winnerId !== Number(match.competitor_b_id)) return Response.json({ error: "Winner must be one of the match competitors" }, { status: 400 });
  if (match.betting_open) return Response.json({ error: "Close betting before recording the winner" }, { status: 400 });
  if (match.status === "completed") return Response.json({ error: "Match is already completed" }, { status: 400 });
  const settlement = await env.DB.prepare(`SELECT id FROM settlements WHERE match_id = ?`).bind(id).first();
  if (settlement) return Response.json({ error: "Match has already been settled" }, { status: 400 });

  await env.DB.prepare(`UPDATE matches SET winner_id = ?, status = 'completed', betting_open = 0 WHERE id = ?`).bind(winnerId, id).run();
  try {
    const advancement = await advanceWinner(env, id);
    const updated = await env.DB.prepare(`SELECT id, round_id, match_number, competitor_a_id, competitor_b_id, winner_id, status, betting_open FROM matches WHERE id = ?`).bind(id).first();
    return Response.json({ success: true, match: updated, advancement });
  } catch (error) {
    return Response.json({ error: `Winner recorded but advancement failed: ${error.message}` }, { status: 500 });
  }
}
