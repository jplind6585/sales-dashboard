-- Phase 2C — Campaigns. Named, multi-type campaigns you load accounts into and track. Types:
-- reengagement | vertical_push | event_followup | expansion | other. Tasks generated for a campaign
-- keep the existing tag (tasks.source_type='campaign', source_id=campaign.id) so the Tasks Campaigns
-- view + the per-account Overview membership both resolve to a real, named campaign.

create table if not exists campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null default 'reengagement',
  status      text not null default 'active',   -- active | paused | done
  description text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists campaign_accounts (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete cascade,
  status      text not null default 'active',   -- active | contacted | responded | won | removed
  added_at    timestamptz not null default now(),
  primary key (campaign_id, account_id)
);

create index if not exists idx_campaign_accounts_account on campaign_accounts(account_id);
create index if not exists idx_campaigns_status on campaigns(status);

alter table campaigns enable row level security;
alter table campaign_accounts enable row level security;
-- Internal tool: authenticated users read/write (service role bypasses RLS for API routes anyway).
drop policy if exists campaigns_rw on campaigns;
create policy campaigns_rw on campaigns for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists campaign_accounts_rw on campaign_accounts;
create policy campaign_accounts_rw on campaign_accounts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
