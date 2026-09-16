CREATE UNIQUE INDEX IF NOT EXISTS idx_rounds_tournament_round ON rounds (tournament_id, round_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_round_match ON matches (round_id, match_number);
