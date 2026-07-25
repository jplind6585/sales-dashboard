-- Phase 0.6 — account hierarchy (company -> property/deal).
-- One company = one MASTER account (is_master, parent_account_id null) shown in the list; its deal/
-- property rows become CHILDREN (parent_account_id -> master). Supports land-and-expand (a company
-- with N properties) and Greystar-style divisions as distinct children, while the list shows one row
-- per company. hubspot_company_id is the native grouping key (populated from the HubSpot deal->company
-- association in sync-deals). Additive + idempotent.

alter table accounts add column if not exists parent_account_id uuid references accounts(id) on delete set null;
alter table accounts add column if not exists is_master boolean not null default false;
alter table accounts add column if not exists hubspot_company_id text;

create index if not exists idx_accounts_parent on accounts(parent_account_id);
create index if not exists idx_accounts_hubspot_company on accounts(hubspot_company_id);
create index if not exists idx_accounts_is_master on accounts(is_master) where is_master;
