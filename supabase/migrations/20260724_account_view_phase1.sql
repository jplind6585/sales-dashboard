-- Account View redesign, Phase 1 (data integrity). Additive + idempotent. The current UI keeps working;
-- this adds the single-source-of-truth substrate: canonical area taxonomy, provenance on derived rows,
-- an events log, the account state machine, and the rollups view every counter will read from.

-- 1) Canonical business-area taxonomy (the 19; replaces the per-account jsonb blob on accounts.business_areas)
create table if not exists business_areas (
  id serial primary key,
  key text unique not null,
  label text not null,
  blurb text,
  sort int
);
insert into business_areas (key, label, sort) values
  ('budgeting','Budgeting',1),
  ('cost_tracking','Cost Tracking',2),
  ('project_tracking','Project Tracking',3),
  ('project_design','Project Design',4),
  ('bidding','Bidding',5),
  ('rfa_process','RFA Process',6),
  ('contracting','Contracting',7),
  ('project_management','Project Management',8),
  ('invoicing','Invoicing',9),
  ('cost_control','Cost Control',10),
  ('cm_fees','CM Fees',11),
  ('change_orders','Change Orders',12),
  ('project_close_out','Project Close Out',13),
  ('reporting','Reporting',14),
  ('unit_renos','Unit Renos',15),
  ('warranties','Warranties',16),
  ('data_loading','Data Loading',17),
  ('due_diligence','Due Diligence',18),
  ('asset_tracking','Asset Tracking',19)
on conflict (key) do nothing;

-- 2) Per-account area state (the "X of Y applicable areas have data" source; fixes the 16-vs-19 split)
create table if not exists account_area_state (
  account_id uuid references accounts(id) on delete cascade,
  area_id int references business_areas(id),
  status text not null default 'not_discussed'
    check (status in ('pain_identified','current_tool_known','discussed','not_discussed','not_applicable')),
  priority text check (priority in ('high','medium','low')),
  summary text,
  evidence jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (account_id, area_id)
);

-- 3) Provenance (receipts) on the derived rows that had none, plus People-tab fields (additive, unused until D)
alter table stakeholders
  add column if not exists evidence jsonb not null default '[]',
  add column if not exists source_call_id text,
  add column if not exists role_guess text,
  add column if not exists champion_strength text check (champion_strength in ('strong','moderate','weak')),
  add column if not exists eb_status text check (eb_status in ('identified','met','unmet')),
  add column if not exists first_seen_call text;

alter table information_gaps
  add column if not exists evidence jsonb not null default '[]',
  add column if not exists source_call_id text,
  add column if not exists blocks_stage text;

-- 4) Events log (Activity feed + audit of stage/state changes; single source of truth for "what happened")
create table if not exists account_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  type text not null,   -- stage_change | state_change | call | email_in | email_out | meeting | commitment_completed | observation
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index if not exists account_events_account_idx on account_events (account_id, occurred_at desc);

-- 5) Account state machine (active | nurture | closed) + never-neither support. accounts.stage stays the ONLY stage.
alter table accounts
  add column if not exists state text not null default 'active' check (state in ('active','nurture','closed')),
  add column if not exists wake_date date,
  add column if not exists wake_reason text,
  add column if not exists closed_reason text,
  add column if not exists momentum_broken_at timestamptz;

-- 6) The rollups view. Every counter reads this; it is structurally impossible to disagree with the tabs
--    because it queries the same tables the tabs render from.
create or replace view account_rollups as
select a.id as account_id,
  (select count(*) from transcripts t where t.account_id = a.id) as transcript_count,
  (select count(*) from stakeholders s where s.account_id = a.id) as stakeholder_count,
  (select count(*) from information_gaps g where g.account_id = a.id and g.status = 'open') as open_gap_count,
  (select count(*) from account_area_state s where s.account_id = a.id and s.status not in ('not_discussed','not_applicable')) as areas_with_data,
  (select count(*) from account_area_state s where s.account_id = a.id and s.status <> 'not_applicable') as areas_applicable
from accounts a;
