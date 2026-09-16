import { requireAdmin } from "../../../lib/auth.js";

export async function onRequestPost({ request, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = body.name?.trim();
  const description = body.description?.trim() || null;
  if (!name) return Response.json({ error: "Tournament name is required" }, { status: 400 });

  const result = await env.DB.prepare(`
    INSERT INTO tournaments (name, description)
    VALUES (?, ?)
    RETURNING id, name, description, status, created_at
  `).bind(name, description).first();
  return Response.json(result, { status: 201 });
}
