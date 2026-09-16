import { requireAdmin } from "../../../../../lib/auth.js";

export async function onRequestPost({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const id = Number(params.id);

  if (!id) {
    return Response.json(
      { error: "Match ID is required" },
      { status: 400 }
    );
  }

  const match = await env.DB.prepare(`
    SELECT
      m.id,
      m.round_id,
      m.match_number,
      m.competitor_a_id,
      m.competitor_b_id,
      m.winner_id,
      m.status,
      m.betting_open,
      r.tournament_id,
      r.round_number
    FROM matches m
    JOIN rounds r ON r.id = m.round_id
    WHERE m.id = ?
  `).bind(id).first();

  if (!match) {
    return Response.json(
      { error: "Match not found" },
      { status: 404 }
    );
  }

  if (match.status !== "completed" || !match.winner_id) {
    return Response.json(
      { error: "Match does not have a recorded winner" },
      { status: 400 }
    );
  }

  const settlement = await env.DB.prepare(`
    SELECT id
    FROM settlements
    WHERE match_id = ?
  `).bind(id).first();

  if (settlement) {
    return Response.json(
      { error: "Cannot undo a winner after the match has been settled" },
      { status: 400 }
    );
  }

  const winnerId = Number(match.winner_id);

  /*
   * Find the next-round match that received this winner.
   *
   * Standard bracket layout:
   * Match 1 -> next match 1, competitor A
   * Match 2 -> next match 1, competitor B
   * Match 3 -> next match 2, competitor A
   * Match 4 -> next match 2, competitor B
   */
  const nextRound = await env.DB.prepare(`
    SELECT id
    FROM rounds
    WHERE tournament_id = ?
      AND round_number = ?
  `).bind(
    match.tournament_id,
    Number(match.round_number) + 1
  ).first();

  let nextMatch = null;

  if (nextRound) {
    const nextMatchNumber = Math.ceil(
      Number(match.match_number) / 2
    );

    nextMatch = await env.DB.prepare(`
      SELECT
        id,
        competitor_a_id,
        competitor_b_id,
        winner_id,
        status,
        betting_open
      FROM matches
      WHERE round_id = ?
        AND match_number = ?
    `).bind(
      nextRound.id,
      nextMatchNumber
    ).first();
  }

  /*
   * If the winner was already used to complete the next
   * match, refuse the undo. We don't want to destroy a
   * later result.
   */
  if (
    nextMatch &&
    (
      Number(nextMatch.winner_id) === winnerId ||
      nextMatch.status === "completed"
    )
  ) {
    return Response.json(
      {
        error:
          "Cannot undo this winner because the next-round match has already been completed."
      },
      { status: 400 }
    );
  }

  /*
   * Remove the winner from the next-round slot only if
   * this match actually placed them there.
   */
  if (nextMatch) {
    if (Number(nextMatch.competitor_a_id) === winnerId) {
      await env.DB.prepare(`
        UPDATE matches
        SET competitor_a_id = NULL
        WHERE id = ?
      `).bind(nextMatch.id).run();
    }

    if (Number(nextMatch.competitor_b_id) === winnerId) {
      await env.DB.prepare(`
        UPDATE matches
        SET competitor_b_id = NULL
        WHERE id = ?
      `).bind(nextMatch.id).run();
    }
  }

  /*
   * Restore the current match to its pre-winner state.
   */
  await env.DB.prepare(`
    UPDATE matches
    SET
      winner_id = NULL,
      status = 'pending',
      betting_open = 0
    WHERE id = ?
  `).bind(id).run();

  const updated = await env.DB.prepare(`
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
  `).bind(id).first();

  return Response.json({
    success: true,
    match: updated,
    advancement_reversed: Boolean(nextMatch)
  });
}
