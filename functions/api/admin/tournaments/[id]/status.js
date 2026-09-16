import { requireAdmin } from "../../../../../lib/auth.js";

const VALID = ["setup", "betting", "in_progress", "completed"];

export async function onRequestPost({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Tournament ID is required" }, { status: 400 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!VALID.includes(body.status)) return Response.json({ error: "Invalid tournament status", valid_statuses: VALID }, { status: 400 });
  const existing = await env.DB.prepare(`SELECT id FROM tournaments WHERE id = ?`).bind(id).first();
  if (!existing) return Response.json({ error: "Tournament not found" }, { status: 404 });
  const updated = await env.DB.prepare(`UPDATE tournaments SET status = ? WHERE id = ? RETURNING id, name, description, status, created_at`).bind(body.status, id).first();
  return Response.json(updated);
}
