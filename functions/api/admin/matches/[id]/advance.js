import { requireAdmin } from "../../../../../lib/auth.js";
import { advanceWinner } from "../../../../../lib/bracket.js";

export async function onRequestPost({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Match ID is required" }, { status: 400 });
  try {
    return Response.json({ success: true, ...(await advanceWinner(env, id)) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
