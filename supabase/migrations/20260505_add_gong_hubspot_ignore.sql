-- Add ignore functionality and HubSpot deal stage caching to gong_call_analyses
ALTER TABLE gong_call_analyses
  ADD COLUMN IF NOT EXISTS ignored BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignore_reason TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_deal_id TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_deal_stage TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_checked_at TIMESTAMPTZ;

-- Set ignored = false for existing rows (ADD COLUMN DEFAULT only applies to new rows)
UPDATE gong_call_analyses SET ignored = false WHERE ignored IS NULL;
