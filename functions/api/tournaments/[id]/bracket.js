export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });

  const tournament = await env.DB
    .prepare(`SELECT id, name, description, status, created_at FROM tournaments WHERE id = ?`)
    .bind(id)
    .first();

  if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });

  const { results } = await env.DB.prepare(`
    SELECT
      r.id AS round_id,
      r.round_number,
      r.name AS round_name,
      m.id AS match_id,
      m.match_number,
      m.competitor_a_id,
      ca.name AS competitor_a_name,
      m.competitor_b_id,
      cb.name AS competitor_b_name,
      m.winner_id,
      m.status,
      m.betting_open,

      COALESCE((
        SELECT SUM(w.amount)
        FROM wagers w
        WHERE w.match_id = m.id
          AND w.status = 'pending'
      ), 0) AS pending_total_pool,

      COALESCE((
        SELECT SUM(w.amount)
        FROM wagers w
        WHERE w.match_id = m.id
          AND w.status = 'pending'
          AND w.competitor_id = m.competitor_a_id
      ), 0) AS pending_a_pool,

      COALESCE((
        SELECT SUM(w.amount)
        FROM wagers w
        WHERE w.match_id = m.id
          AND w.status = 'pending'
          AND w.competitor_id = m.competitor_b_id
      ), 0) AS pending_b_pool,

      s.id AS settlement_id,
      COALESCE(s.total_pool, 0) AS settled_total_pool,
      COALESCE(s.winning_pool, 0) AS settled_winning_pool,
      COALESCE(s.losing_pool, 0) AS settled_losing_pool,
      COALESCE(s.tournament_cut, 0) AS settled_tournament_cut,
      COALESCE(s.payout_pool, 0) AS settled_payout_pool,
      s.settled_at

    FROM rounds r
    LEFT JOIN matches m ON m.round_id = r.id
    LEFT JOIN competitors ca ON ca.id = m.competitor_a_id
    LEFT JOIN competitors cb ON cb.id = m.competitor_b_id
    LEFT JOIN settlements s ON s.match_id = m.id
    WHERE r.tournament_id = ?
    ORDER BY r.round_number, m.match_number
  `).bind(id).all();

  const rounds = [];

  for (const row of results) {
    let round = rounds.find((r) => r.id === row.round_id);

    if (!round) {
      round = {
        id: row.round_id,
        round_number: row.round_number,
        name: row.round_name,
        matches: []
      };
      rounds.push(round);
    }

    if (row.match_id) {
      round.matches.push({
        id: row.match_id,
        match_number: row.match_number,
        competitor_a: row.competitor_a_id
          ? { id: row.competitor_a_id, name: row.competitor_a_name }
          : null,
        competitor_b: row.competitor_b_id
          ? { id: row.competitor_b_id, name: row.competitor_b_name }
          : null,
        winner_id: row.winner_id,
        status: row.status,
        betting_open: Boolean(row.betting_open),

        betting: {
          pending_total_pool: Number(row.pending_total_pool),
          pending_a_pool: Number(row.pending_a_pool),
          pending_b_pool: Number(row.pending_b_pool),
          settlement_id: row.settlement_id || null,
          settled_total_pool: Number(row.settled_total_pool),
          settled_winning_pool: Number(row.settled_winning_pool),
          settled_losing_pool: Number(row.settled_losing_pool),
          settled_tournament_cut: Number(row.settled_tournament_cut),
          settled_payout_pool: Number(row.settled_payout_pool),
          settled_at: row.settled_at || null
        }
      });
    }
  }

  return Response.json({ tournament, rounds });
}
