-- Wave 5 (2026-07-18): ROI tracker + cross-team work requests. Idempotent.

-- Initiatives: things you spend on to grow the funnel (hire an SDR, a conference, a paid ad, a
-- tool). The ROI tracker attributes pipeline/revenue to each. (PLATFORM_REVIEW ROI-tracker scope.)
CREATE TABLE IF NOT EXISTS initiatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text,                            -- hire_sdr | conference | paid_ad | tool | other
  cost          numeric,
  cost_period   text DEFAULT 'one_time',         -- one_time | monthly | annual
  started_on    date,
  ended_on      date,
  status        text DEFAULT 'active',           -- active | ended
  owner_name    text,                            -- for hire_sdr: attribute this rep's deals
  expected_outcome text,
  notes         text,
  created_by    uuid,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS initiatives_rw ON initiatives;
CREATE POLICY initiatives_rw ON initiatives FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Work requests: a rep asks a non-sales teammate (designer, sales engineer) for something, and the
-- fulfiller gets the account context automatically. (PLATFORM_REVIEW cross-team scope, MVP.)
CREATE TABLE IF NOT EXISTS work_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid REFERENCES accounts(id),
  requester_id   uuid REFERENCES profiles(id),
  requester_name text,
  assignee_role  text,                           -- designer | sales_engineer | marketing | other
  assignee_id    uuid REFERENCES profiles(id),
  type           text,                           -- content | custom_demo | one_pager | other
  title          text NOT NULL,
  details        text,
  context_snapshot jsonb,                        -- auto-assembled account context at request time
  status         text DEFAULT 'open',            -- open | in_progress | delivered | cancelled
  due_date       date,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS work_requests_rw ON work_requests;
CREATE POLICY work_requests_rw ON work_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_work_requests_status ON work_requests(status);
CREATE INDEX IF NOT EXISTS idx_work_requests_account ON work_requests(account_id);
