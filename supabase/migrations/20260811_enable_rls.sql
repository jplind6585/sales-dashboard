-- Clear the "RLS Disabled in Public" advisor warnings (James, 2026-08-11). The app talks to the DB with
-- the SERVICE-ROLE key server-side, which BYPASSES RLS, so enabling RLS deny-by-default is non-breaking
-- for every server path. Only account_stage_history is read directly by the browser (authenticated), so
-- it gets a permissive policy; the rest are server-only → deny-all (most secure). Same posture as
-- account_briefs / account_proposals / proposal_config.

alter table public.account_merge_log            enable row level security;
alter table public.account_stage_history        enable row level security;
alter table public.archived_content             enable row level security;
alter table public.call_coaching_cards          enable row level security;
alter table public.company_logos                enable row level security;
alter table public.content_templates            enable row level security;
alter table public.executed_actions             enable row level security;
alter table public.hubspot_sync_log             enable row level security;
alter table public.investor_narratives          enable row level security;
alter table public.lead_pipeline                enable row level security;
alter table public.orem_activity_uploads        enable row level security;
alter table public.pipeline_call_sessions       enable row level security;
alter table public.playbook_steps               enable row level security;
alter table public.rep_confidence_snapshots     enable row level security;
alter table public.sales_process_config         enable row level security;
alter table public.sales_process_config_history enable row level security;
alter table public.task_chat_messages           enable row level security;
alter table public.task_chats                   enable row level security;
alter table public.task_dismissals              enable row level security;
alter table public.task_playbook_runs           enable row level security;
alter table public.task_playbooks               enable row level security;

-- account_stage_history is read directly by the browser (logged-in user) — keep that working.
drop policy if exists account_stage_history_auth on public.account_stage_history;
create policy account_stage_history_auth on public.account_stage_history
  for all to authenticated using (true) with check (true);
