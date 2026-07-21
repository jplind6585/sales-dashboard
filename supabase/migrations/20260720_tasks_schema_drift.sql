-- Document columns the code writes/reads on public.tasks but that live only out-of-band (created via
-- the dashboard, never in a repo migration): momentum, source_type, primary_action, rationale.
-- IF NOT EXISTS => a no-op on the live DB, and makes a from-scratch rebuild match the code.
alter table public.tasks add column if not exists source_type text;
alter table public.tasks add column if not exists primary_action text;
alter table public.tasks add column if not exists rationale text;
alter table public.tasks add column if not exists momentum text;
