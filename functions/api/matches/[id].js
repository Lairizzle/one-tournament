export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Match ID is required" }, { status: 400 });

  const match = await env.DB.prepare(`
    SELECT m.id, m.match_number, m.competitor_a_id, ca.name AS competitor_a_name,
           m.competitor_b_id, cb.name AS competitor_b_name,
           m.winner_id, m.status, m.betting_open, r.id AS round_id, r.round_number, r.name AS round_name,
           t.id AS tournament_id, t.name AS tournament_name
    FROM matches m
    JOIN rounds r ON r.id = m.round_id
    JOIN tournaments t ON t.id = r.tournament_id
    LEFT JOIN competitors ca ON ca.id = m.competitor_a_id
    LEFT JOIN competitors cb ON cb.id = m.competitor_b_id
    WHERE m.id = ?
  `).bind(id).first();

  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });

  const pools = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total_pool,
           COALESCE(SUM(CASE WHEN competitor_id = ? THEN amount ELSE 0 END),0) AS a_pool,
           COALESCE(SUM(CASE WHEN competitor_id = ? THEN amount ELSE 0 END),0) AS b_pool
    FROM wagers
    WHERE match_id = ? AND status = 'pending'
  `).bind(match.competitor_a_id, match.competitor_b_id, id).first();

  const total = Number(pools.total_pool);
  const aPool = Number(pools.a_pool);
  const bPool = Number(pools.b_pool);
  const settlement = await env.DB
    .prepare(`SELECT id, winning_pool, losing_pool, total_pool, tournament_cut, payout_pool, settled_at FROM settlements WHERE match_id = ?`)
    .bind(id)
    .first();

  return Response.json({
    id: match.id,
    match_number: match.match_number,
    tournament: { id: match.tournament_id, name: match.tournament_name },
    round: { id: match.round_id, number: match.round_number, name: match.round_name },
    competitor_a: { id: match.competitor_a_id, name: match.competitor_a_name, pool: aPool, odds: aPool ? Math.max(1, (total * 0.9) / aPool) : null },
    competitor_b: { id: match.competitor_b_id, name: match.competitor_b_name, pool: bPool, odds: bPool ? Math.max(1, (total * 0.9) / bPool) : null },
    winner_id: match.winner_id,
    status: match.status,
    betting_open: Boolean(match.betting_open),
    total_pool: total,
    tournament_cut_rate: 0.10,
    payout_rate: 0.90,
    settlement
  });
}
