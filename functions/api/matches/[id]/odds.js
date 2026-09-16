export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Match ID is required" }, { status: 400 });
  const match = await env.DB.prepare(`SELECT m.id, m.status, m.betting_open, m.competitor_a_id, ca.name AS competitor_a_name, m.competitor_b_id, cb.name AS competitor_b_name FROM matches m LEFT JOIN competitors ca ON ca.id = m.competitor_a_id LEFT JOIN competitors cb ON cb.id = m.competitor_b_id WHERE m.id = ?`).bind(id).first();
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  const pools = await env.DB.prepare(`SELECT COALESCE(SUM(amount),0) AS total_pool, COALESCE(SUM(CASE WHEN competitor_id = ? THEN amount ELSE 0 END),0) AS a_pool, COALESCE(SUM(CASE WHEN competitor_id = ? THEN amount ELSE 0 END),0) AS b_pool FROM wagers WHERE match_id = ? AND status = 'pending'`).bind(match.competitor_a_id, match.competitor_b_id, id).first();
  const total = Number(pools.total_pool), a = Number(pools.a_pool), b = Number(pools.b_pool);
  return Response.json({
    match: { id: match.id, status: match.status, betting_open: Boolean(match.betting_open) },
    competitor_a: { id: match.competitor_a_id, name: match.competitor_a_name, pool: a, odds: a ? (total * 0.9) / a : null },
    competitor_b: { id: match.competitor_b_id, name: match.competitor_b_name, pool: b, odds: b ? (total * 0.9) / b : null },
    total_pool: total, tournament_cut_rate: 0.10, payout_rate: 0.90
  });
}
