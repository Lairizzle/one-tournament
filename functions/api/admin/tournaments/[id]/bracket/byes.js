import { requireAdmin } from "../../../../../../lib/auth.js";
import { advanceWinner } from "../../../../../../lib/bracket.js";

export async function onRequestPost({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const tournamentId = Number(params.id);
  if (!tournamentId) return Response.json({ error: "Tournament ID is required" }, { status: 400 });
  const { results } = await env.DB.prepare(`
    SELECT m.id, m.competitor_a_id, m.competitor_b_id, m.status
    FROM matches m JOIN rounds r ON r.id = m.round_id
    WHERE r.tournament_id = ? AND m.competitor_a_id IS NOT NULL AND m.competitor_b_id IS NULL AND m.status != 'completed'
    UNION ALL
    SELECT m.id, m.competitor_a_id, m.competitor_b_id, m.status
    FROM matches m JOIN rounds r ON r.id = m.round_id
    WHERE r.tournament_id = ? AND m.competitor_a_id IS NULL AND m.competitor_b_id IS NOT NULL AND m.status != 'completed'
  `).bind(tournamentId, tournamentId).all();

  const advanced = [];
  for (const match of results) {
    const winnerId = match.competitor_a_id ?? match.competitor_b_id;
    await env.DB.prepare(`UPDATE matches SET winner_id = ?, status = 'completed', betting_open = 0 WHERE id = ?`).bind(winnerId, match.id).run();
    advanced.push({ match_id: match.id, ...(await advanceWinner(env, match.id)) });
  }
  return Response.json({ success: true, tournament_id: tournamentId, byes_processed: results.length, advanced });
}
