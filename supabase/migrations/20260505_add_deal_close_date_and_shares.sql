-- Add deal close date and name to gong_call_analyses
-- Used by the new HubSpot deal-contact matching enrichment
ALTER TABLE gong_call_analyses
  ADD COLUMN IF NOT EXISTS deal_close_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deal_name TEXT;

-- Share tokens for public read-only report links (no login required)
CREATE TABLE IF NOT EXISTS report_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
  created_by UUID REFERENCES auth.users(id)
);

-- Allow public reads (token-validated at API level, no RLS needed)
ALTER TABLE report_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read by token" ON report_shares FOR SELECT USING (true);
CREATE POLICY "Auth users insert own" ON report_shares FOR INSERT WITH CHECK (auth.uid() = created_by);
