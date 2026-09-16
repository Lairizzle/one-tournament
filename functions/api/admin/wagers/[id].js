import { requireAdmin } from "../../../../lib/auth.js";

export async function onRequestDelete({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Wager ID is required" }, { status: 400 });
  const wager = await env.DB.prepare(`
    SELECT w.id, w.status, m.status AS match_status FROM wagers w JOIN matches m ON m.id = w.match_id WHERE w.id = ?
  `).bind(id).first();
  if (!wager) return Response.json({ error: "Wager not found" }, { status: 404 });
  if (wager.status !== "pending") return Response.json({ error: "Only pending wagers can be deleted" }, { status: 400 });
  if (wager.match_status === "completed") return Response.json({ error: "Cannot delete a wager after the match is completed" }, { status: 400 });
  await env.DB.prepare(`DELETE FROM wagers WHERE id = ?`).bind(id).run();
  return Response.json({ success: true, id });
}
