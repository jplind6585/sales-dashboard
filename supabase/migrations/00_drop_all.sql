-- DROP ALL — run this to wipe the schema clean before re-running from scratch
-- Tables first (CASCADE drops dependent triggers, indexes, policies automatically)
-- Then functions

drop table if exists public.archived_content cascade;
drop table if exists public.company_logos cascade;
drop table if exists public.generated_content cascade;
drop table if exists public.content_templates cascade;
drop table if exists public.recurring_task_templates cascade;
drop table if exists public.tasks cascade;
drop table if exists public.notes cascade;
drop table if exists public.information_gaps cascade;
drop table if exists public.stakeholders cascade;
drop table if exists public.transcripts cascade;
drop table if exists public.accounts cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.update_updated_at_column() cascade;
drop function if exists public.handle_task_completion() cascade;
drop function if exists public.is_manager_or_admin() cascade;
