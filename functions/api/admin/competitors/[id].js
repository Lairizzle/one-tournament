import { requireAdmin } from "../../../../lib/auth.js";

export async function onRequestDelete({ request, params, env }) {
  const auth = requireAdmin(request, env);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const competitorId = Number(params.id);

  if (!Number.isInteger(competitorId) || competitorId <= 0) {
    return Response.json(
      { error: "Invalid competitor ID" },
      { status: 400 }
    );
  }

  const competitor = await env.DB.prepare(`
    SELECT
      c.id,
      c.name,
      c.tournament_id,
      t.status
    FROM competitors c
    JOIN tournaments t ON t.id = c.tournament_id
    WHERE c.id = ?
  `)
    .bind(competitorId)
    .first();

  if (!competitor) {
    return Response.json(
      { error: "Competitor not found" },
      { status: 404 }
    );
  }

  if (competitor.status !== "setup") {
    return Response.json(
      { error: "Competitors can only be removed while the tournament is in setup" },
      { status: 409 }
    );
  }

  const bracketMatch = await env.DB.prepare(`
    SELECT id
    FROM matches
    WHERE competitor_a_id = ?
       OR competitor_b_id = ?
    LIMIT 1
  `)
    .bind(competitorId, competitorId)
    .first();

  if (bracketMatch) {
    return Response.json(
      { error: "Competitor is already in the bracket and cannot be removed" },
      { status: 409 }
    );
  }

  await env.DB.prepare(`
    DELETE FROM competitors
    WHERE id = ?
  `)
    .bind(competitorId)
    .run();

  return Response.json({
    ok: true,
    deleted: {
      id: competitor.id,
      name: competitor.name
    }
  });
}
