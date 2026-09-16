export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });

  const tournament = await env.DB
    .prepare(`SELECT id, name, description, status, created_at FROM tournaments WHERE id = ?`)
    .bind(id)
    .first();

  if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });

  const { results } = await env.DB.prepare(`
    SELECT r.id AS round_id, r.round_number, r.name AS round_name,
           m.id AS match_id, m.match_number,
           m.competitor_a_id, ca.name AS competitor_a_name,
           m.competitor_b_id, cb.name AS competitor_b_name,
           m.winner_id, m.status, m.betting_open
    FROM rounds r
    LEFT JOIN matches m ON m.round_id = r.id
    LEFT JOIN competitors ca ON ca.id = m.competitor_a_id
    LEFT JOIN competitors cb ON cb.id = m.competitor_b_id
    WHERE r.tournament_id = ?
    ORDER BY r.round_number, m.match_number
  `).bind(id).all();

  const rounds = [];
  for (const row of results) {
    let round = rounds.find((r) => r.id === row.round_id);
    if (!round) {
      round = { id: row.round_id, round_number: row.round_number, name: row.round_name, matches: [] };
      rounds.push(round);
    }

    if (row.match_id) {
      round.matches.push({
        id: row.match_id,
        match_number: row.match_number,
        competitor_a: row.competitor_a_id ? { id: row.competitor_a_id, name: row.competitor_a_name } : null,
        competitor_b: row.competitor_b_id ? { id: row.competitor_b_id, name: row.competitor_b_name } : null,
        winner_id: row.winner_id,
        status: row.status,
        betting_open: Boolean(row.betting_open)
      });
    }
  }

  return Response.json({ tournament, rounds });
}
