-- account_briefs: cache for the mode-aware Overview account brief (pages/api/accounts/brief.js).
-- brief.js already reads (select ... eq account_id eq mode) and writes (upsert onConflict
-- account_id,mode) this table, but it was never created — so the cache silently no-op'd and the brief
-- regenerated a full Sonnet call on every account open. This makes the cache real: same inputs
-- (input_hash) return the stored brief instantly instead of hitting Anthropic each load.
create table if not exists public.account_briefs (
  id           bigint generated always as identity primary key,
  account_id   uuid not null references public.accounts(id) on delete cascade,
  mode         text not null,                    -- post_call | nurture | working | pre_call
  content      jsonb not null,                   -- the structured brief object
  input_hash   text,                             -- sha1 of the brief's inputs; unchanged hash → serve cache
  generated_at timestamptz not null default now(),
  constraint account_briefs_account_mode_key unique (account_id, mode)
);

create index if not exists idx_account_briefs_account on public.account_briefs(account_id);

-- Only the server API (service role) reads/writes this; service role bypasses RLS. No client policy =
-- deny by default for anon/authenticated, consistent with the profiles RLS lockdown.
alter table public.account_briefs enable row level security;
