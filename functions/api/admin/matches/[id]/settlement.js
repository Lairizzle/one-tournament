import { requireAdmin } from "../../../../../lib/auth.js";

export async function onRequestGet({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Match ID is required" }, { status: 400 });
  const settlement = await env.DB.prepare(`SELECT id, match_id, winning_pool, losing_pool, total_pool, tournament_cut, payout_pool, settled_at FROM settlements WHERE match_id = ?`).bind(id).first();
  if (!settlement) return Response.json({ error: "Match has not been settled" }, { status: 404 });
  const { results: payouts } = await env.DB.prepare(`SELECT p.id, p.wager_id, p.bettor_id, b.name AS bettor_name, p.amount, p.created_at FROM payouts p JOIN bettors b ON b.id = p.bettor_id WHERE p.settlement_id = ? ORDER BY p.id`).bind(settlement.id).all();
  return Response.json({ settlement, payouts });
}
