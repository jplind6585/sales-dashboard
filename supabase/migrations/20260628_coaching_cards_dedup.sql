-- Coaching-card dedup (2026-06-28). call_coaching_cards was created ad-hoc (no prior
-- migration). This makes it reproducible and adds UNIQUE(gong_call_id) so the per-call
-- coaching DM can upsert race-free (prereq for the staged intel-analyze atomic-claim fix —
-- see OVERNIGHT_LEDGER.md ⚠️ NEEDS-REVIEW). Idempotent + safe to re-run.
--
-- NOTE: no tasks UNIQUE(gong_call_id) here on purpose — one call legitimately creates several
-- tasks (commitments + next steps); the task double-creation race is closed by the atomic
-- claim in intel-analyze, not a DB constraint.

CREATE TABLE IF NOT EXISTS call_coaching_cards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_email    text,
  gong_call_id text,
  account_name text,
  call_date    timestamptz,
  strength     text,
  fix          text,
  next_focus   text,
  full_message text,
  sent_at      timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

-- Collapse any pre-existing duplicates (keep the earliest row per gong_call_id) before
-- the unique index, or the index creation would fail.
DELETE FROM call_coaching_cards a
  USING call_coaching_cards b
  WHERE a.gong_call_id IS NOT NULL
    AND a.gong_call_id = b.gong_call_id
    AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_coaching_gong_call_id
  ON call_coaching_cards(gong_call_id) WHERE gong_call_id IS NOT NULL;
