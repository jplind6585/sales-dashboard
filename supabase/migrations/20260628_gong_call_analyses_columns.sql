-- Rebuild-safety (2026-06-28): gong_call_analyses columns that the app reads/writes/filters
-- but were added to the live DB via out-of-band ALTERs and never checked in. These are
-- ADD COLUMN IF NOT EXISTS, so this is a NO-OP on the live database — it only matters when
-- rebuilding the schema from migrations/. Verify types against `\d gong_call_analyses` if
-- you ever change them. Read by: rep-coaching, competitive-analytics, intel-aggregate,
-- ceo-dashboard, call-registry, account-calls, reports/feed.

ALTER TABLE gong_call_analyses ADD COLUMN IF NOT EXISTS transcript_text   TEXT;
ALTER TABLE gong_call_analyses ADD COLUMN IF NOT EXISTS call_category     TEXT;   -- sales | cs | internal | unknown
ALTER TABLE gong_call_analyses ADD COLUMN IF NOT EXISTS derived_call_type TEXT;   -- intro | demo | solution_validation | implementation | training | customer_success | other
ALTER TABLE gong_call_analyses ADD COLUMN IF NOT EXISTS account_id        UUID REFERENCES accounts(id);
ALTER TABLE gong_call_analyses ADD COLUMN IF NOT EXISTS match_confidence  FLOAT;
ALTER TABLE gong_call_analyses ADD COLUMN IF NOT EXISTS match_method      TEXT;

CREATE INDEX IF NOT EXISTS idx_gca_call_category ON gong_call_analyses(call_category);
CREATE INDEX IF NOT EXISTS idx_gca_account_id    ON gong_call_analyses(account_id);
