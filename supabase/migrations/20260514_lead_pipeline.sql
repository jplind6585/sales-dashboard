-- Lead pipeline table — synced from Google Sheets "2026 New Interest" tab
-- One row per intro booked. Upserted on (year, seq) via sync-leads API.
CREATE TABLE IF NOT EXISTS lead_pipeline (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year                SMALLINT NOT NULL DEFAULT 2026,
  seq                 INTEGER NOT NULL,
  company             TEXT,
  company_size        TEXT,
  vertical            TEXT,
  contact_dept        TEXT,
  contact_seniority   TEXT,
  booked_via          TEXT,
  sdr                 TEXT,
  ae                  TEXT,
  date_booked         DATE,
  date_demo           DATE,
  intro_status        TEXT,  -- Showed | No Show | Cancelled | Rescheduling | Upcoming
  qualify_status      TEXT,  -- Qualified | Not Qualified | TBD
  evaluation_status   TEXT,  -- Presented | Still Evaluating | Did Not Present
  proposal_status     TEXT,  -- Sent | TBD | Not sent
  closed_status       TEXT,  -- Won | Lost | Working
  date_closed         DATE,
  arr_value           NUMERIC,
  reason_not_closed   TEXT,
  lost_tags           TEXT,
  lost_stage          TEXT,
  next_action         TEXT,
  next_action_date    DATE,
  arr_estimate_open   NUMERIC,
  forecast_category   TEXT,
  days_since_booked   INTEGER,
  pipeline_age_flag   TEXT,
  synced_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year, seq)
);

CREATE INDEX IF NOT EXISTS idx_lead_pipeline_year         ON lead_pipeline(year);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_date_booked  ON lead_pipeline(date_booked DESC);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_sdr          ON lead_pipeline(sdr);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_ae           ON lead_pipeline(ae);
CREATE INDEX IF NOT EXISTS idx_lead_pipeline_closed       ON lead_pipeline(closed_status);
