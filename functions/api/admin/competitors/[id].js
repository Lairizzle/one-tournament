import { requireAdmin } from "../../../../lib/auth.js";

export async function onRequestDelete({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const competitorId = Number(params.id);

  if (!Number.isInteger(competitorId) || competitorId <= 0) {
    return Response.json(
      { error: "Invalid competitor ID" },
      { status: 400 }
    );
  }

  const competitor = await env.DB
    .prepare(`
      SELECT id, name, tournament_id
      FROM competitors
      WHERE id = ?
    `)
    .bind(competitorId)
    .first();

  if (!competitor) {
    return Response.json(
      { error: "Competitor not found" },
      { status: 404 }
    );
  }

  const bracket = await env.DB
    .prepare(`
      SELECT id
      FROM rounds
      WHERE tournament_id = ?
      LIMIT 1
    `)
    .bind(competitor.tournament_id)
    .first();

  if (bracket) {
    return Response.json(
      { error: "Cannot remove competitors after the bracket has been generated" },
      { status: 409 }
    );
  }

  await env.DB
    .prepare(`DELETE FROM competitors WHERE id = ?`)
    .bind(competitorId)
    .run();

  return Response.json({
    success: true,
    deleted: {
      id: competitor.id,
      name: competitor.name
    }
  });
}
