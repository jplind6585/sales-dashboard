-- Wave 5 M5 (2026-07-18): Living Deal Room — a shareable, engagement-tracked buyer microsite per
-- account with a grounded ROI model. Public read is served by a service-role endpoint keyed on the
-- unguessable token. Idempotent.
CREATE TABLE IF NOT EXISTS deal_rooms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid REFERENCES accounts(id),
  token          text UNIQUE NOT NULL,
  headline       text,
  config         jsonb,            -- optional value-input overrides
  views          int DEFAULT 0,
  last_viewed_at timestamptz,
  created_by     uuid,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE deal_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deal_rooms_rw ON deal_rooms;
CREATE POLICY deal_rooms_rw ON deal_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_deal_rooms_token ON deal_rooms(token);
CREATE INDEX IF NOT EXISTS idx_deal_rooms_account ON deal_rooms(account_id);
