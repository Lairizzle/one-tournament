import { requireAdmin } from "../../../../lib/auth.js";

export async function onRequestPut({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });
  const existing = await env.DB.prepare(`SELECT id FROM tournaments WHERE id = ?`).bind(id).first();
  if (!existing) return Response.json({ error: "Tournament not found" }, { status: 404 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = body.name?.trim();
  const description = body.description?.trim() || null;
  if (!name) return Response.json({ error: "Tournament name is required" }, { status: 400 });
  const updated = await env.DB.prepare(`
    UPDATE tournaments SET name = ?, description = ? WHERE id = ?
    RETURNING id, name, description, status, created_at
  `).bind(name, description, id).first();
  return Response.json(updated);
}

export async function onRequestDelete({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });
  const tournament = await env.DB.prepare(`SELECT id, name FROM tournaments WHERE id = ?`).bind(id).first();
  if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });

  const { results: matches } = await env.DB.prepare(`
    SELECT m.id FROM matches m JOIN rounds r ON r.id = m.round_id WHERE r.tournament_id = ?
  `).bind(id).all();
  const matchIds = matches.map((m) => Number(m.id));

  if (matchIds.length) {
    const q = matchIds.map(() => "?").join(",");
    await env.DB.prepare(`DELETE FROM payouts WHERE settlement_id IN (SELECT id FROM settlements WHERE match_id IN (${q}))`).bind(...matchIds).run();
    await env.DB.prepare(`DELETE FROM settlements WHERE match_id IN (${q})`).bind(...matchIds).run();
    await env.DB.prepare(`DELETE FROM wagers WHERE match_id IN (${q})`).bind(...matchIds).run();
  }

  await env.DB.prepare(`DELETE FROM matches WHERE round_id IN (SELECT id FROM rounds WHERE tournament_id = ?)`).bind(id).run();
  await env.DB.prepare(`DELETE FROM rounds WHERE tournament_id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM competitors WHERE tournament_id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM bettors WHERE tournament_id = ?`).bind(id).run();
  await env.DB.prepare(`DELETE FROM tournaments WHERE id = ?`).bind(id).run();

  return Response.json({ success: true, deleted: tournament });
}
