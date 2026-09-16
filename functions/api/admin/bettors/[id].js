import { requireAdmin } from "../../../../lib/auth.js";

export async function onRequestGet({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Bettor ID is required" }, { status: 400 });
  const bettor = await env.DB.prepare(`SELECT id, tournament_id, name, created_at FROM bettors WHERE id = ?`).bind(id).first();
  if (!bettor) return Response.json({ error: "Bettor not found" }, { status: 404 });
  const { results: wagers } = await env.DB.prepare(`
    SELECT w.id, w.match_id, w.competitor_id, c.name AS competitor_name, w.amount, w.odds_at_bet, w.status, w.payout, w.created_at
    FROM wagers w JOIN competitors c ON c.id = w.competitor_id WHERE w.bettor_id = ? ORDER BY w.id DESC
  `).bind(id).all();
  return Response.json({ bettor, wagers });
}

export async function onRequestPut({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = body.name?.trim();
  if (!id || !name) return Response.json({ error: "Bettor ID and name are required" }, { status: 400 });
  const existing = await env.DB.prepare(`SELECT id FROM bettors WHERE id = ?`).bind(id).first();
  if (!existing) return Response.json({ error: "Bettor not found" }, { status: 404 });
  return Response.json(await env.DB.prepare(`UPDATE bettors SET name = ? WHERE id = ? RETURNING id, tournament_id, name, created_at`).bind(name, id).first());
}

export async function onRequestDelete({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Bettor ID is required" }, { status: 400 });
  const wager = await env.DB.prepare(`SELECT id FROM wagers WHERE bettor_id = ? LIMIT 1`).bind(id).first();
  if (wager) return Response.json({ error: "Bettor cannot be deleted after wagers have been recorded" }, { status: 400 });
  const deleted = await env.DB.prepare(`DELETE FROM bettors WHERE id = ? RETURNING id, name`).bind(id).first();
  if (!deleted) return Response.json({ error: "Bettor not found" }, { status: 404 });
  return Response.json({ success: true, deleted });
}
