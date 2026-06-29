-- SDR engine (2026-06-28): Supabase-backed outreach touch log, replacing the localStorage-only
-- pursuit touch tracking so the manager can see SDR/AE activity. Powers the Call Queue's daily
-- target progress + future activity reporting. Idempotent.

CREATE TABLE IF NOT EXISTS sdr_touches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid REFERENCES accounts(id),
  rep_id      uuid REFERENCES profiles(id),
  touch_type  text NOT NULL DEFAULT 'call',   -- call | email | linkedin | voicemail | meeting
  outcome     text,
  notes       text,
  touched_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE sdr_touches ENABLE ROW LEVEL SECURITY;
-- Permissive read/write for authenticated users, consistent with the app's informal role model
-- (writes go through the service-role client with rep_id stamped from the session).
DROP POLICY IF EXISTS sdr_touches_rw ON sdr_touches;
CREATE POLICY sdr_touches_rw ON sdr_touches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sdr_touches_rep_day ON sdr_touches(rep_id, touched_at);
CREATE INDEX IF NOT EXISTS idx_sdr_touches_account ON sdr_touches(account_id);
