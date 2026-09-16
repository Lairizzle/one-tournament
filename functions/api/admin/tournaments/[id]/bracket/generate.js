import { requireAdmin } from "../../../../../../lib/auth.js";
import { roundName } from "../../../../../../lib/bracket.js";

function secureShuffle(items) {
  const values = [...items];
  const random = new Uint32Array(1);

  for (let i = values.length - 1; i > 0; i--) {
    const maxExclusive = i + 1;
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let value;

    do {
      crypto.getRandomValues(random);
      value = random[0];
    } while (value >= limit);

    const j = value % maxExclusive;
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

export async function onRequestPost({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const tournamentId = Number(params.id);
  if (!tournamentId) return Response.json({ error: "Tournament ID is required" }, { status: 400 });

  const tournament = await env.DB
    .prepare(`SELECT id, status FROM tournaments WHERE id = ?`)
    .bind(tournamentId)
    .first();

  if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });
  if (tournament.status !== "setup") return Response.json({ error: "Bracket can only be generated during setup" }, { status: 400 });

  const existing = await env.DB
    .prepare(`SELECT id FROM rounds WHERE tournament_id = ? LIMIT 1`)
    .bind(tournamentId)
    .first();

  if (existing) return Response.json({ error: "Bracket already exists" }, { status: 400 });

  const { results: competitors } = await env.DB
    .prepare(`SELECT id, name FROM competitors WHERE tournament_id = ? ORDER BY id`)
    .bind(tournamentId)
    .all();

  if (competitors.length < 2) return Response.json({ error: "At least 2 competitors are required" }, { status: 400 });

  // Randomize the complete field before placing competitors into the bracket.
  // If the field is not a power of two, the shuffled ordering also determines
  // who receives the round-one byes after the bracket is padded with empty slots.
  const shuffled = secureShuffle(competitors);
  const bracketSize = 2 ** Math.ceil(Math.log2(shuffled.length));
  const roundCount = Math.log2(bracketSize);

  const statements = [];
  for (let round = 1; round <= roundCount; round++) {
    statements.push(
      env.DB
        .prepare(`INSERT INTO rounds (tournament_id, round_number, name) VALUES (?, ?, ?)`)
        .bind(tournamentId, round, roundName(round, roundCount))
    );
  }

  await env.DB.batch(statements);

  const { results: rounds } = await env.DB
    .prepare(`SELECT id, round_number, name FROM rounds WHERE tournament_id = ? ORDER BY round_number`)
    .bind(tournamentId)
    .all();

  const matchStatements = [];
  for (const round of rounds) {
    const matchCount = bracketSize / (2 ** round.round_number);

    for (let matchNumber = 1; matchNumber <= matchCount; matchNumber++) {
      let a = null;
      let b = null;

      if (round.round_number === 1) {
        const index = (matchNumber - 1) * 2;
        a = shuffled[index]?.id ?? null;
        b = shuffled[index + 1]?.id ?? null;
      }

      matchStatements.push(
        env.DB
          .prepare(`INSERT INTO matches (round_id, match_number, competitor_a_id, competitor_b_id) VALUES (?, ?, ?, ?)`)
          .bind(round.id, matchNumber, a, b)
      );
    }
  }

  await env.DB.batch(matchStatements);

  return Response.json({
    success: true,
    tournament_id: tournamentId,
    competitor_count: competitors.length,
    bracket_size: bracketSize,
    round_count: roundCount
  }, { status: 201 });
}
