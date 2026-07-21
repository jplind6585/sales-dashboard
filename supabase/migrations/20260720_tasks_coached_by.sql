-- Coached-call attribution: when a call is LED by one rep but a coach (e.g. James) is among the
-- attendees, the extracted action items belong to the deal owner (the lead rep) but are tagged with
-- the coach's id so the coach can filter "Calls I coached". Nullable — normal tasks leave it null.
alter table public.tasks add column if not exists coached_by uuid references public.profiles(id);
create index if not exists idx_tasks_coached_by on public.tasks(coached_by) where coached_by is not null;
