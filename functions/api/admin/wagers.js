import { requireAdmin } from "../../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const matchId = Number(new URL(request.url).searchParams.get("match_id"));
  if (!matchId) return Response.json({ error: "Match ID is required" }, { status: 400 });
  const { results } = await env.DB.prepare(`
    SELECT w.id, w.match_id, w.bettor_id, b.name AS bettor_name, w.competitor_id, c.name AS competitor_name,
           w.amount, w.odds_at_bet, w.status, w.payout, w.created_at
    FROM wagers w JOIN bettors b ON b.id = w.bettor_id JOIN competitors c ON c.id = w.competitor_id
    WHERE w.match_id = ? ORDER BY w.created_at, w.id
  `).bind(matchId).all();
  return Response.json(results);
}

export async function onRequestPost({ request, env }) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const matchId = Number(body.match_id);
  const bettorId = Number(body.bettor_id);
  const competitorId = Number(body.competitor_id);
  const amount = Number(body.amount);
  if (!matchId || !bettorId || !competitorId) return Response.json({ error: "Match, bettor, and competitor are required" }, { status: 400 });
  if (!Number.isSafeInteger(amount) || amount <= 0) return Response.json({ error: "Amount must be a positive whole number" }, { status: 400 });

  const match = await env.DB.prepare(`
    SELECT m.id, m.competitor_a_id, m.competitor_b_id, m.status, m.betting_open, r.tournament_id
    FROM matches m JOIN rounds r ON r.id = m.round_id WHERE m.id = ?
  `).bind(matchId).first();
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  if (!match.betting_open) return Response.json({ error: "Betting is not open for this match" }, { status: 400 });
  if (match.status === "completed") return Response.json({ error: "Match is already completed" }, { status: 400 });
  if (competitorId !== match.competitor_a_id && competitorId !== match.competitor_b_id) return Response.json({ error: "Competitor is not in this match" }, { status: 400 });

  const bettor = await env.DB.prepare(`SELECT id, tournament_id FROM bettors WHERE id = ?`).bind(bettorId).first();
  if (!bettor) return Response.json({ error: "Bettor not found" }, { status: 404 });
  if (bettor.tournament_id !== match.tournament_id) return Response.json({ error: "Bettor belongs to a different tournament" }, { status: 400 });

  const pools = await env.DB.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total_pool,
           COALESCE(SUM(CASE WHEN competitor_id = ? THEN amount ELSE 0 END),0) AS side_pool
    FROM wagers WHERE match_id = ? AND status = 'pending'
  `).bind(competitorId, matchId).first();
  const totalAfter = Number(pools.total_pool) + amount;
  const sideAfter = Number(pools.side_pool) + amount;
  const oddsAtBet = (totalAfter * 0.9) / sideAfter;

  const wager = await env.DB.prepare(`
    INSERT INTO wagers (match_id, bettor_id, competitor_id, amount, odds_at_bet)
    VALUES (?, ?, ?, ?, ?)
    RETURNING id, match_id, bettor_id, competitor_id, amount, odds_at_bet, status, payout, created_at
  `).bind(matchId, bettorId, competitorId, amount, oddsAtBet).first();
  return Response.json(wager, { status: 201 });
}
