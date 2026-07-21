-- Seed the pre-call and post-call playbooks (trigger = 'pre_call' / 'post_call'). These define the
-- checklist the app auto-creates before each external meeting and after each analyzed call. Editable
-- in /modules/playbooks. Idempotent: only seeds when that trigger type doesn't already exist.
-- due_offset_hours: pre-call is relative to the MEETING (negative = before); post-call is relative
-- to the CALL (positive = after).
insert into public.task_playbooks (name, trigger, role, description, steps, active, stage_trigger)
select 'Pre-call checklist', 'pre_call', 'ae', 'Auto-created before an external meeting',
  '[
    {"title":"Review the account — last call, open gaps, MEDDICC","priority":2,"due_offset_hours":-24},
    {"title":"Confirm the agenda and who is attending","priority":2,"due_offset_hours":-24},
    {"title":"Prep 2–3 discovery questions for this stage","priority":2,"due_offset_hours":-2},
    {"title":"Decide the specific ask / next step to land","priority":1,"due_offset_hours":-2}
  ]'::jsonb, true, 'all'
where not exists (select 1 from public.task_playbooks where trigger = 'pre_call');

insert into public.task_playbooks (name, trigger, role, description, steps, active, stage_trigger)
select 'Post-call checklist', 'post_call', 'ae', 'Auto-created after an analyzed call',
  '[
    {"title":"Send recap + next steps within 2 hours","priority":1,"due_offset_hours":2},
    {"title":"Log call notes and update the deal stage","priority":2,"due_offset_hours":4},
    {"title":"Confirm the next step is on the calendar","priority":2,"due_offset_hours":24},
    {"title":"Update MEDDICC / capture any new gaps","priority":3,"due_offset_hours":24}
  ]'::jsonb, true, 'all'
where not exists (select 1 from public.task_playbooks where trigger = 'post_call');
