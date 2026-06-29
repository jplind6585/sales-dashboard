-- Task Engine Vision (2026-06-28)
-- 1. Every task carries a pre-generated, adaptable AI action ("never start blank").
-- 2. Trigger metadata so we know what fired the task.
-- 3. Configurable revenue/pipeline goals for the reporting command center.

-- ── Tasks: AI action + trigger ────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_draft JSONB;
-- shape: { kind, role, content, model, generated_at, edited }
--   kind: 'email' | 'call_prep' | 'deck' | 'notes' | 'plan' | 'generic'

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "trigger" TEXT;  -- quoted: belt-and-suspenders (non-reserved, but safe)
-- 'gong_action_item' | 'gong_commitment' | 'calendar_prep' | 'calendar_followup'
-- | 'recurring' | 'manual' | 'sdr_dial'

-- ── Sales goals (revenue / pipeline) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        text NOT NULL DEFAULT 'team',     -- 'team' | 'rep'
  owner_id     uuid REFERENCES profiles(id),     -- null for team-wide
  metric       text NOT NULL DEFAULT 'revenue',  -- 'revenue' | 'pipeline'
  period       text NOT NULL DEFAULT 'quarter',  -- 'month' | 'quarter' | 'year'
  period_start date NOT NULL,
  target       numeric NOT NULL,
  label        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE sales_goals ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read goals; managers manage them (mirrors the app's informal role model).
DROP POLICY IF EXISTS sales_goals_read ON sales_goals;
CREATE POLICY sales_goals_read ON sales_goals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sales_goals_write ON sales_goals;
CREATE POLICY sales_goals_write ON sales_goals FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tasks_trigger ON tasks("trigger");
CREATE INDEX IF NOT EXISTS idx_sales_goals_period ON sales_goals(period_start, metric);
