import { requireAdmin } from "../../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  return Response.json({ ok: true });
}
