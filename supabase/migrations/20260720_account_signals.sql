-- Phase 0 foundations: per-account signal rollup (from the Gong analysis pipeline) + task snooze.
-- account_signals is written by the analysis path (service role) and read by Today / By-Account /
-- the at-risk radar. Sentiment stored numerically for trend math; engagement uses champion-health.

create table if not exists account_signals (
  account_id uuid primary key references accounts(id) on delete cascade,
  sentiment numeric,                          -- latest: positive=1, neutral=0, negative=-1
  engagement numeric,                         -- latest champion-health proxy (1-10)
  rep_talk_ratio numeric,                     -- latest rep talk ratio (0-100)
  meddicc_completeness numeric,               -- 0..1 fraction of MEDDICC keys filled
  last_call_at timestamptz,                   -- most recent analyzed sales call
  trend jsonb not null default '[]'::jsonb,   -- recent points [{date,sentiment,engagement}]
  updated_at timestamptz not null default now()
);

alter table account_signals enable row level security;
do $$ begin
  create policy account_signals_read on account_signals for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- Task snooze (Phase 1: natural-language / quick snooze on the wall + Today's Focus).
alter table tasks add column if not exists snooze_until timestamptz;
