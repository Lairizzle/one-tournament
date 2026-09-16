CREATE INDEX IF NOT EXISTS idx_competitors_tournament ON competitors (tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches (round_id);
CREATE INDEX IF NOT EXISTS idx_wagers_match ON wagers (match_id);
CREATE INDEX IF NOT EXISTS idx_wagers_bettor ON wagers (bettor_id);
CREATE INDEX IF NOT EXISTS idx_settlements_match ON settlements (match_id);
CREATE INDEX IF NOT EXISTS idx_payouts_settlement ON payouts (settlement_id);
