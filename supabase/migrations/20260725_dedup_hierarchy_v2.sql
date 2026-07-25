-- Phase 0.2 (v2) — dedup with tighter normalization. Supersedes 20260725_dedup_hierarchy.sql.
-- Groups by a normalized company key: lowercase, punctuation -> space, strip a trailing legal suffix
-- (inc/llc/corp/corporation/incorporated/ltd/limited/lp/llp/co). This catches near-variants the exact
-- match missed ("AvalonBay Communities" vs "AvalonBay Communities, Inc.", "Sares Regis" vs "Sares-Regis",
-- case differences). Verified safe: biggest group = 7, all new merges are genuine legal-suffix/case/
-- hyphen variants. NON-DESTRUCTIVE + reversible (only is_master / parent_account_id tags).
-- Reverse: update accounts set is_master=false, parent_account_id=null;

-- 1. Clear any prior tags so re-grouping is clean.
update accounts set is_master = false, parent_account_id = null
where is_master or parent_account_id is not null;

-- 2. Tag masters (primary live deal per company).
with n as (
  select id, stage, deal_value, updated_at,
    trim(regexp_replace(regexp_replace(regexp_replace(lower(name),'[^a-z0-9]+',' ','g'),
      '\s+(inc|llc|corp|corporation|incorporated|ltd|limited|lp|llp|co)\s*$','','g'),'\s+',' ','g')) as nk
  from accounts
),
grp as (
  select id, nk,
    count(*) over (partition by nk) as grp_size,
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

-- 3. Tag children (siblings -> master).
with n as (
  select id, stage, deal_value, updated_at,
    trim(regexp_replace(regexp_replace(regexp_replace(lower(name),'[^a-z0-9]+',' ','g'),
      '\s+(inc|llc|corp|corporation|incorporated|ltd|limited|lp|llp|co)\s*$','','g'),'\s+',' ','g')) as nk
  from accounts
),
grp as (
  select id, nk,
    count(*) over (partition by nk) as grp_size,
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
