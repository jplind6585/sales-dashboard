-- Step A backfill: derive stakeholders + information gaps from every analyzed, matched, non-CS Gong call.
-- Idempotent (NOT EXISTS guards + DISTINCT ON), provenance stamped, conservative (role left null to avoid
-- any CHECK conflicts; role_guess carries the normalized guess for the People tab). No validation tasks.

insert into stakeholders (account_id, name, title, role_guess, evidence, source_call_id, first_seen_call, created_at, updated_at)
select distinct on (g.account_id, lower(trim(s->>'name')))
  g.account_id,
  trim(s->>'name'),
  nullif(trim(coalesce(s->>'title','')), ''),
  case
    when nullif(trim(coalesce(s->>'role','')),'') is not null then lower(replace(trim(s->>'role'),' ','_'))
    when lower(coalesce(s->>'is_champion','')) = 'true' then 'champion'
    else null
  end,
  jsonb_build_array(jsonb_build_object('call_id', g.gong_call_id, 'captured_at', g.call_date)),
  g.gong_call_id, g.gong_call_id, now(), now()
from gong_call_analyses g
cross join lateral jsonb_array_elements(coalesce(g.analysis->'stakeholders','[]'::jsonb)) s
where g.account_id is not null
  and g.ignored is not true
  and g.call_category is distinct from 'cs'
  and g.analysis is not null
  and length(trim(coalesce(s->>'name',''))) >= 2
  and not exists (
    select 1 from stakeholders x
    where x.account_id = g.account_id and lower(x.name) = lower(trim(s->>'name'))
  )
order by g.account_id, lower(trim(s->>'name')), g.call_date desc nulls last;

insert into information_gaps (account_id, question, category, status, evidence, source_call_id, created_at)
select distinct on (g.account_id, lower(trim(gap->>'question')))
  g.account_id,
  trim(gap->>'question'),
  coalesce(nullif(trim(gap->>'category'),''),'other'),
  'open',
  jsonb_build_array(jsonb_build_object('call_id', g.gong_call_id, 'captured_at', g.call_date)),
  g.gong_call_id, now()
from gong_call_analyses g
cross join lateral jsonb_array_elements(coalesce(g.analysis->'information_gaps','[]'::jsonb)) gap
where g.account_id is not null
  and g.ignored is not true
  and g.call_category is distinct from 'cs'
  and g.analysis is not null
  and jsonb_typeof(gap) = 'object'
  and length(trim(coalesce(gap->>'question',''))) > 5
  and not exists (
    select 1 from information_gaps x
    where x.account_id = g.account_id and lower(trim(x.question)) = lower(trim(gap->>'question'))
  )
order by g.account_id, lower(trim(gap->>'question')), g.call_date desc nulls last;
