export function roundName(roundNumber, roundCount) {
  if (roundNumber === roundCount) return "Final";
  if (roundNumber === roundCount - 1) return "Semifinal";
  if (roundNumber === roundCount - 2) return "Quarterfinal";
  return `Round ${roundNumber}`;
}

export async function getFinalRoundNumber(env, tournamentId) {
  const row = await env.DB
    .prepare("SELECT MAX(round_number) AS round_number FROM rounds WHERE tournament_id = ?")
    .bind(tournamentId)
    .first();

  return Number(row?.round_number || 0);
}

export async function advanceWinner(env, matchId) {
  const match = await env.DB
    .prepare(`
      SELECT
        m.id,
        m.round_id,
        m.match_number,
        m.winner_id,
        m.status,
        r.tournament_id,
        r.round_number
      FROM matches m
      JOIN rounds r ON r.id = m.round_id
      WHERE m.id = ?
    `)
    .bind(matchId)
    .first();

  if (!match) throw new Error("Match not found");
  if (match.status !== "completed") throw new Error("Match must be completed before advancing");
  if (!match.winner_id) throw new Error("Match does not have a winner");

  const finalRoundNumber = await getFinalRoundNumber(env, match.tournament_id);

  if (match.round_number === finalRoundNumber) {
    await env.DB
      .prepare("UPDATE tournaments SET status = 'completed' WHERE id = ?")
      .bind(match.tournament_id)
      .run();

    return { final: true, winner_id: match.winner_id, next_match: null };
  }

  const nextRound = await env.DB
    .prepare(`SELECT id FROM rounds WHERE tournament_id = ? AND round_number = ?`)
    .bind(match.tournament_id, match.round_number + 1)
    .first();

  if (!nextRound) throw new Error("Next round not found");

  const nextMatchNumber = Math.ceil(match.match_number / 2);

  const nextMatch = await env.DB
    .prepare(`
      SELECT id, competitor_a_id, competitor_b_id
      FROM matches
      WHERE round_id = ? AND match_number = ?
    `)
    .bind(nextRound.id, nextMatchNumber)
    .first();

  if (!nextMatch) throw new Error("Next match not found");

  if (
    Number(nextMatch.competitor_a_id) === Number(match.winner_id) ||
    Number(nextMatch.competitor_b_id) === Number(match.winner_id)
  ) {
    return { final: false, already_advanced: true, winner_id: match.winner_id, next_match: nextMatch };
  }

  const column = match.match_number % 2 === 1 ? "competitor_a_id" : "competitor_b_id";
  const current = column === "competitor_a_id"
    ? nextMatch.competitor_a_id
    : nextMatch.competitor_b_id;

  if (current !== null) throw new Error("Next-round slot is already occupied");

  await env.DB
    .prepare(`UPDATE matches SET ${column} = ? WHERE id = ?`)
    .bind(match.winner_id, nextMatch.id)
    .run();

  const updated = await env.DB
    .prepare(`
      SELECT id, round_id, match_number, competitor_a_id, competitor_b_id,
             winner_id, status, betting_open
      FROM matches WHERE id = ?
    `)
    .bind(nextMatch.id)
    .first();

  return { final: false, already_advanced: false, winner_id: match.winner_id, next_match: updated };
}
