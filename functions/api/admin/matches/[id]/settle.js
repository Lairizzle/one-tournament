import { requireAdmin } from "../../../../../lib/auth.js";

export async function onRequestPost({ request, params, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const id = Number(params.id);
  if (!id) return Response.json({ error: "Match ID is required" }, { status: 400 });

  const match = await env.DB.prepare(`
    SELECT m.id, m.winner_id, m.status, m.betting_open FROM matches m WHERE m.id = ?
  `).bind(id).first();
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  if (match.status !== "completed" || !match.winner_id) return Response.json({ error: "Match must be completed with a winner before settlement" }, { status: 400 });
  if (match.betting_open) return Response.json({ error: "Betting must be closed before settlement" }, { status: 400 });

  const existing = await env.DB.prepare(`SELECT id FROM settlements WHERE match_id = ?`).bind(id).first();
  if (existing) return Response.json({ error: "Match has already been settled", settlement_id: existing.id }, { status: 400 });

  const { results: wagers } = await env.DB.prepare(`SELECT id, bettor_id, competitor_id, amount FROM wagers WHERE match_id = ? AND status = 'pending' ORDER BY id`).bind(id).all();
  const totalPool = wagers.reduce((s, w) => s + Number(w.amount), 0);
  const winningWagers = wagers.filter((w) => Number(w.competitor_id) === Number(match.winner_id));
  const winningPool = winningWagers.reduce((s, w) => s + Number(w.amount), 0);
  const losingPool = totalPool - winningPool;
  const tournamentCut = Math.floor(totalPool * 0.10);
  const payoutPool = totalPool - tournamentCut;

  const payouts = winningWagers.map((w) => ({
    wager: w,
    amount: Math.floor((Number(w.amount) / winningPool) * payoutPool),
    remainder: ((Number(w.amount) / winningPool) * payoutPool) % 1
  }));

  let distributed = payouts.reduce((s, p) => s + p.amount, 0);
  let leftover = payoutPool - distributed;
  payouts.sort((a, b) => b.remainder - a.remainder || Number(a.wager.id) - Number(b.wager.id));
  for (const item of payouts) {
    if (leftover <= 0) break;
    item.amount += 1;
    leftover -= 1;
  }
  payouts.sort((a, b) => Number(a.wager.id) - Number(b.wager.id));

  const settlementInsert = env.DB.prepare(`
    INSERT INTO settlements (match_id, winning_pool, losing_pool, total_pool, tournament_cut, payout_pool)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, winningPool, losingPool, totalPool, tournamentCut, payoutPool);

  const statements = [settlementInsert];
  for (const wager of wagers) {
    const payout = payouts.find((p) => Number(p.wager.id) === Number(wager.id))?.amount ?? 0;
    const status = Number(wager.competitor_id) === Number(match.winner_id) ? "won" : "lost";
    statements.push(env.DB.prepare(`UPDATE wagers SET status = ?, payout = ? WHERE id = ? AND status = 'pending'`).bind(status, payout, wager.id));
  }
  for (const item of payouts) {
    statements.push(env.DB.prepare(`
      INSERT INTO payouts (settlement_id, wager_id, bettor_id, amount)
      SELECT id, ?, ?, ? FROM settlements WHERE match_id = ?
    `).bind(item.wager.id, item.wager.bettor_id, item.amount, id));
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    return Response.json({ error: `Settlement failed: ${error.message}` }, { status: 500 });
  }

  const settlement = await env.DB.prepare(`SELECT id, match_id, winning_pool, losing_pool, total_pool, tournament_cut, payout_pool, settled_at FROM settlements WHERE match_id = ?`).bind(id).first();
  const { results: payoutRows } = await env.DB.prepare(`
    SELECT p.id, p.wager_id, p.bettor_id, b.name AS bettor_name, p.amount, p.created_at
    FROM payouts p JOIN bettors b ON b.id = p.bettor_id WHERE p.settlement_id = ? ORDER BY p.id
  `).bind(settlement.id).all();
  return Response.json({ success: true, settlement, payouts: payoutRows });
}
