import { requireAdmin } from "../../../../lib/auth.js";

export async function onRequestGet({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Match ID is required" }, { status: 400 });
  const match = await env.DB.prepare(`
    SELECT m.id, m.round_id, m.match_number, m.competitor_a_id, ca.name AS competitor_a_name,
           m.competitor_b_id, cb.name AS competitor_b_name, m.winner_id, m.status, m.betting_open,
           r.tournament_id, r.round_number, r.name AS round_name
    FROM matches m JOIN rounds r ON r.id = m.round_id
    LEFT JOIN competitors ca ON ca.id = m.competitor_a_id
    LEFT JOIN competitors cb ON cb.id = m.competitor_b_id
    WHERE m.id = ?
  `).bind(id).first();
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  return Response.json(match);
}
