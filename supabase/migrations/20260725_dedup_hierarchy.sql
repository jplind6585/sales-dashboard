-- Phase 0.2 — dedup existing accounts into a company hierarchy (NON-DESTRUCTIVE, reversible).
-- Groups accounts by exact normalized name (high confidence). Per company with >1 account, designates
-- the primary deal as the MASTER (furthest-along live stage, then highest value, then most recent) and
-- tags the siblings as CHILDREN (parent_account_id -> master). No merge, no delete, no data movement —
-- just is_master / parent_account_id tags. Reverse with: update accounts set is_master=false,
-- parent_account_id=null where parent_account_id is not null or is_master. Near-name variants (e.g.
-- "Adam America" vs "Adam America Real Estate") are NOT grouped here — they go to the Data Quality
-- review queue. Metrics still count every row (all are real deals); only browse lists hide children.
-- Idempotent: re-running re-computes the same masters/children.

with grp as (
  select
    id,
    lower(trim(name)) as nm,
    count(*) over (partition by lower(trim(name))) as grp_size,
    row_number() over (
      partition by lower(trim(name))
      order by
        case stage
          when 'legal' then 1 when 'proposal' then 2 when 'solution_validation' then 3
          when 'demo' then 4 when 'active_pursuit' then 5 when 'qualifying' then 6
          when 'intro_scheduled' then 7 when 'closed_won' then 8 else 9 end,
        coalesce(deal_value, 0) desc,
        updated_at desc nulls last
    ) as rn
  from accounts
),
masters as (select nm, id as master_id from grp where rn = 1 and grp_size > 1)
update accounts a
set is_master = true, parent_account_id = null
from masters m
where a.id = m.master_id;

with grp as (
  select
    id,
    lower(trim(name)) as nm,
    count(*) over (partition by lower(trim(name))) as grp_size,
    row_number() over (
      partition by lower(trim(name))
      order by
        case stage
          when 'legal' then 1 when 'proposal' then 2 when 'solution_validation' then 3
          when 'demo' then 4 when 'active_pursuit' then 5 when 'qualifying' then 6
          when 'intro_scheduled' then 7 when 'closed_won' then 8 else 9 end,
        coalesce(deal_value, 0) desc,
        updated_at desc nulls last
    ) as rn
  from accounts
),
masters as (select nm, id as master_id from grp where rn = 1 and grp_size > 1)
update accounts a
set parent_account_id = m.master_id
from grp g
join masters m on m.nm = g.nm
where a.id = g.id and g.rn > 1;
