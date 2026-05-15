-- Add changed_by_name and days_in_prior_stage to stage history (existing table was missing these)
ALTER TABLE account_stage_history ADD COLUMN IF NOT EXISTS changed_by_name TEXT;
ALTER TABLE account_stage_history ADD COLUMN IF NOT EXISTS days_in_prior_stage INTEGER;

-- Drop DB trigger — stage history is now written from the app layer (captures changed_by, changed_by_name, days_in_prior_stage)
DROP TRIGGER IF EXISTS trg_stage_change ON accounts;

-- Competitor tracking on accounts (1-2 max)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS competitor1 TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS competitor2 TEXT;
