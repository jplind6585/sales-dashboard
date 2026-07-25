-- Phase 0.3 — durable dedup prevention. Wraps the v2 grouping logic in a re-runnable function so the
-- nightly sync (sync-deals) can call it after upserting deals: any new deal for an existing company
-- auto-becomes a CHILD of that company's master instead of a new top-level duplicate. Idempotent —
-- recomputes masters (furthest-along live deal) each run. NOTE: clears + recomputes all tags, so if
-- manual hierarchy overrides are ever added, guard them before relying on this.

create or replace function regroup_account_hierarchy()
returns void language plpgsql as $$
begin
  update accounts set is_master = false, parent_account_id = null
  where is_master or parent_account_id is not null;

  with n as (
    select id, stage, deal_value, updated_at,
      trim(regexp_replace(regexp_replace(regexp_replace(lower(name),'[^a-z0-9]+',' ','g'),
        '\s+(inc|llc|corp|corporation|incorporated|ltd|limited|lp|llp|co)\s*$','','g'),'\s+',' ','g')) as nk
    from accounts
  ),
  grp as (
    select id, nk, count(*) over (partition by nk) as grp_size,
      row_number() over (partition by nk order by
        case stage when 'legal' then 1 when 'proposal' then 2 when 'solution_validation' then 3
          when 'demo' then 4 when 'active_pursuit' then 5 when 'qualifying' then 6
          when 'intro_scheduled' then 7 when 'closed_won' then 8 else 9 end,
        coalesce(deal_value,0) desc, updated_at desc nulls last, id) as rn
    from n
  ),
  masters as (select nk, id as master_id from grp where rn = 1 and grp_size > 1)
  update accounts a set is_master = true, parent_account_id = null
  from masters m where a.id = m.master_id;

  with n as (
    select id, stage, deal_value, updated_at,
      trim(regexp_replace(regexp_replace(regexp_replace(lower(name),'[^a-z0-9]+',' ','g'),
        '\s+(inc|llc|corp|corporation|incorporated|ltd|limited|lp|llp|co)\s*$','','g'),'\s+',' ','g')) as nk
    from accounts
  ),
  grp as (
    select id, nk, count(*) over (partition by nk) as grp_size,
      row_number() over (partition by nk order by
        case stage when 'legal' then 1 when 'proposal' then 2 when 'solution_validation' then 3
          when 'demo' then 4 when 'active_pursuit' then 5 when 'qualifying' then 6
          when 'intro_scheduled' then 7 when 'closed_won' then 8 else 9 end,
        coalesce(deal_value,0) desc, updated_at desc nulls last, id) as rn
    from n
  ),
  masters as (select nk, id as master_id from grp where rn = 1 and grp_size > 1)
  update accounts a set parent_account_id = m.master_id
  from grp g join masters m on m.nk = g.nk
  where a.id = g.id and g.rn > 1;
end $$;
