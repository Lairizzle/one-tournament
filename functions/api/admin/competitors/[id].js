import { requireAdmin } from "../../../../lib/auth.js";

export async function onRequestPut({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const id = Number(params.id);
  if (!id) return Response.json({ error: "Competitor ID is required" }, { status: 400 });

  const competitor = await env.DB
    .prepare(`SELECT id, tournament_id FROM competitors WHERE id = ?`)
    .bind(id)
    .first();

  if (!competitor) return Response.json({ error: "Competitor not found" }, { status: 404 });

  const tournament = await env.DB
    .prepare(`SELECT status FROM tournaments WHERE id = ?`)
    .bind(competitor.tournament_id)
    .first();

  if (!tournament || tournament.status !== "setup") {
    return Response.json({ error: "Competitors can only be changed during setup" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) return Response.json({ error: "Competitor name is required" }, { status: 400 });

  const used = await env.DB
    .prepare(`SELECT id FROM matches WHERE competitor_a_id = ? OR competitor_b_id = ? OR winner_id = ? LIMIT 1`)
    .bind(id, id, id)
    .first();

  if (used) {
    return Response.json({ error: "Competitor cannot be edited after entering the bracket" }, { status: 400 });
  }

  const updated = await env.DB
    .prepare(`UPDATE competitors SET name = ? WHERE id = ? RETURNING id, tournament_id, name, created_at`)
    .bind(name, id)
    .first();

  return Response.json(updated);
}

export async function onRequestDelete({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const id = Number(params.id);
  if (!id) return Response.json({ error: "Competitor ID is required" }, { status: 400 });

  const used = await env.DB
    .prepare(`SELECT id FROM matches WHERE competitor_a_id = ? OR competitor_b_id = ? OR winner_id = ? LIMIT 1`)
    .bind(id, id, id)
    .first();

  if (used) return Response.json({ error: "Competitor cannot be deleted after entering the bracket" }, { status: 400 });

  const deleted = await env.DB
    .prepare(`DELETE FROM competitors WHERE id = ? RETURNING id, name`)
    .bind(id)
    .first();

  if (!deleted) return Response.json({ error: "Competitor not found" }, { status: 404 });

  return Response.json({ success: true, deleted });
}
