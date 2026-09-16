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
      JOIN rounds r
        ON r.id = m.round_id
      WHERE m.id = ?
    `)
    .bind(matchId)
    .first();

  if (!match) {
    throw new Error("Match not found");
  }

  if (match.status !== "completed") {
    throw new Error("Match must be completed before advancing");
  }

  if (!match.winner_id) {
    throw new Error("Match does not have a winner");
  }

  if (match.round_number === await getFinalRoundNumber(env, match.tournament_id)) {
    await env.DB
      .prepare(`
        UPDATE tournaments
        SET status = 'completed'
        WHERE id = ?
          AND status != 'completed'
      `)
      .bind(match.tournament_id)
      .run();

    return {
      final: true,
      winner_id: match.winner_id,
      next_match: null
    };
  }

  const nextRound = await env.DB
    .prepare(`
      SELECT id
      FROM rounds
      WHERE tournament_id = ?
        AND round_number = ?
    `)
    .bind(match.tournament_id, match.round_number + 1)
    .first();

  if (!nextRound) {
    throw new Error("Next round not found");
  }

  const nextMatchNumber = Math.ceil(match.match_number / 2);

  const nextMatch = await env.DB
    .prepare(`
      SELECT
        id,
        competitor_a_id,
        competitor_b_id,
        winner_id,
        status
      FROM matches
      WHERE round_id = ?
        AND match_number = ?
    `)
    .bind(nextRound.id, nextMatchNumber)
    .first();

  if (!nextMatch) {
    throw new Error("Next match not found");
  }

  const winnerAlreadyPresent =
    nextMatch.competitor_a_id === match.winner_id ||
    nextMatch.competitor_b_id === match.winner_id;

  if (winnerAlreadyPresent) {
    return {
      final: false,
      already_advanced: true,
      winner_id: match.winner_id,
      next_match: nextMatch
    };
  }

  const slot = match.match_number % 2 === 1 ? "a" : "b";
  const currentSlot = slot === "a"
    ? nextMatch.competitor_a_id
    : nextMatch.competitor_b_id;

  if (currentSlot !== null) {
    throw new Error("Next-round slot is already occupied");
  }

  const column = slot === "a"
    ? "competitor_a_id"
    : "competitor_b_id";

  await env.DB
    .prepare(`
      UPDATE matches
      SET ${column} = ?
      WHERE id = ?
    `)
    .bind(match.winner_id, nextMatch.id)
    .run();

  const updatedNextMatch = await env.DB
    .prepare(`
      SELECT
        id,
        round_id,
        match_number,
        competitor_a_id,
        competitor_b_id,
        winner_id,
        status,
        betting_open
      FROM matches
      WHERE id = ?
    `)
    .bind(nextMatch.id)
    .first();

  return {
    final: false,
    already_advanced: false,
    winner_id: match.winner_id,
    next_match: updatedNextMatch
  };
}

export async function getFinalRoundNumber(env, tournamentId) {
  const row = await env.DB
    .prepare(`
      SELECT MAX(round_number) AS round_number
      FROM rounds
      WHERE tournament_id = ?
    `)
    .bind(tournamentId)
    .first();

  return Number(row?.round_number || 0);
}
