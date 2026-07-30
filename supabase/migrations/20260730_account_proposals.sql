-- Proposal / Eval-Doc generator (plan 2026-07-29, decisions locked 2026-07-30).
-- Feature 1: fresh-from-transcripts eval docs, in-app versioned prompt, workspace chat.
-- All tables service-role only (RLS on, no client policy) — the API uses getSupabase().

-- One living eval/proposal doc per account. Every run is a FRESH generate from transcripts;
-- the prior doc is snapshotted into versions[] for side-by-side comparison.
create table if not exists public.account_proposals (
  id                bigint generated always as identity primary key,
  account_id        uuid not null references public.accounts(id) on delete cascade,
  content           jsonb not null,                 -- structured doc (lib/proposalSpec schema)
  markdown          text,                           -- rendered copy for export
  transcript_ids    text[] not null default '{}',   -- gong_call_ids used in the latest run
  account_context   text,                           -- accumulated deal-specific feedback; feeds every fresh generate
  version           int not null default 1,
  versions          jsonb not null default '[]',    -- capped history [{version, content, transcript_ids, change_summary, at}]
  source_call_count int,
  created_by        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint account_proposals_account_key unique (account_id)
);
create index if not exists idx_account_proposals_account on public.account_proposals(account_id);

-- Workspace chat thread / feedback log for a given account's proposal.
create table if not exists public.account_proposal_messages (
  id          bigint generated always as identity primary key,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  role        text not null check (role in ('user','assistant','system')),
  content     text not null,
  metadata    jsonb,                                -- {scope:'systemic'|'deal_specific', doc_version, applied}
  created_at  timestamptz not null default now()
);
create index if not exists idx_app_msgs_account on public.account_proposal_messages(account_id, created_at);

-- Single-row, versioned GLOBAL instructions for the eval-doc generator (retires the claude.ai project).
-- Edited in-app; read at generate time; a change takes effect on the next fresh generate.
create table if not exists public.proposal_config (
  id           bigint generated always as identity primary key,
  instructions text not null default '',            -- the project/system instructions
  rubric       text not null default '',            -- self-critique checklist
  exemplars    jsonb not null default '[]',         -- [{label, content}] few-shot finished docs
  version      int not null default 1,
  updated_by   text,
  updated_at   timestamptz not null default now()
);

create table if not exists public.proposal_config_history (
  id           bigint generated always as identity primary key,
  version      int not null,
  instructions text,
  rubric       text,
  exemplars    jsonb,
  updated_by   text,
  created_at   timestamptz not null default now()
);

alter table public.account_proposals         enable row level security;
alter table public.account_proposal_messages enable row level security;
alter table public.proposal_config           enable row level security;
alter table public.proposal_config_history   enable row level security;
