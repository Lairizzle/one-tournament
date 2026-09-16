export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });

  const tournament = await env.DB
    .prepare(`SELECT id, name, description, status, created_at FROM tournaments WHERE id = ?`)
    .bind(id)
    .first();

  if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });

  const competitors = await env.DB
    .prepare(`SELECT COUNT(*) AS count FROM competitors WHERE tournament_id = ?`)
    .bind(id)
    .first();

  const matches = await env.DB
    .prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(CASE WHEN m.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
             COALESCE(SUM(CASE WHEN m.betting_open = 1 THEN 1 ELSE 0 END), 0) AS betting_open
      FROM matches m
      JOIN rounds r ON r.id = m.round_id
      WHERE r.tournament_id = ?
    `)
    .bind(id)
    .first();

  const betting = await env.DB
    .prepare(`
      SELECT COALESCE(SUM(w.amount),0) AS total_wagered,
             COUNT(DISTINCT w.bettor_id) AS bettor_count,
             COALESCE(SUM(CASE WHEN w.status = 'won' THEN w.payout ELSE 0 END),0) AS total_payouts
      FROM wagers w
      JOIN matches m ON m.id = w.match_id
      JOIN rounds r ON r.id = m.round_id
      WHERE r.tournament_id = ?
    `)
    .bind(id)
    .first();

  const cut = await env.DB
    .prepare(`
      SELECT COALESCE(SUM(s.tournament_cut),0) AS total_cut
      FROM settlements s
      JOIN matches m ON m.id = s.match_id
      JOIN rounds r ON r.id = m.round_id
      WHERE r.tournament_id = ?
    `)
    .bind(id)
    .first();

  const champion = await env.DB
    .prepare(`
      SELECT c.id, c.name
      FROM matches m
      JOIN rounds r ON r.id = m.round_id
      JOIN competitors c ON c.id = m.winner_id
      WHERE r.tournament_id = ?
        AND r.round_number = (SELECT MAX(round_number) FROM rounds WHERE tournament_id = ?)
        AND m.status = 'completed'
      LIMIT 1
    `)
    .bind(id, id)
    .first();

  return Response.json({
    tournament: { ...tournament, cut: Number(cut.total_cut) },
    competitors: { count: Number(competitors.count) },
    matches: { total: Number(matches.total), completed: Number(matches.completed), betting_open: Number(matches.betting_open) },
    betting: { total_wagered: Number(betting.total_wagered), bettor_count: Number(betting.bettor_count), total_payouts: Number(betting.total_payouts) },
    champion: champion || null
  });
}
