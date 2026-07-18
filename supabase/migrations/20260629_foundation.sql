-- Wave 1 foundation (2026-06-29). Columns the shared stage-history writer (lib/stageHistory.js)
-- and the lead↔account reconciliation (lib/accountMatch + sheets/match-leads) depend on. Idempotent.

-- account_stage_history: assistant/execute.js already tries to insert changed_by; the column was
-- never added (audit row silently dropped). Add it so the single writer records who moved a deal.
ALTER TABLE account_stage_history ADD COLUMN IF NOT EXISTS changed_by uuid;

-- lead_pipeline: sheets/match-leads.js writes these three but no migration ever added them, so the
-- update failed silently and the two funnels never reconciled.
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id);
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS match_confidence numeric;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS match_method text;

CREATE INDEX IF NOT EXISTS idx_lead_pipeline_account ON lead_pipeline(account_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_account ON account_stage_history(account_id, changed_at);
