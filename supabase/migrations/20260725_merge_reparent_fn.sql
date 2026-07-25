-- Phase 0.1 — safe account merge.
-- The old merge endpoint re-parented only 5 of 31 account_id tables, then hard-deleted the absorbed
-- account, silently cascade-deleting signals/facts/history/content/etc. This function re-parents EVERY
-- account_id table (excluding the account_rollups VIEW) in one transaction, with conflict handling for
-- the 5 tables that carry an account_id uniqueness constraint. It does NOT delete the absorbed account
-- (the endpoint still snapshots + logs + deletes, so unmerge keeps working).

create or replace function merge_accounts_reparent(p_canonical uuid, p_absorbed uuid)
returns void
language plpgsql
as $$
begin
  if p_canonical = p_absorbed then
    raise exception 'cannot merge an account into itself';
  end if;

  -- Plain FK tables (many rows per account): straight re-parent.
  update gong_call_analyses   set account_id = p_canonical where account_id = p_absorbed;
  update tasks                set account_id = p_canonical where account_id = p_absorbed;
  update stakeholders         set account_id = p_canonical where account_id = p_absorbed;
  update notes                set account_id = p_canonical where account_id = p_absorbed;
  update transcripts          set account_id = p_canonical where account_id = p_absorbed;
  update information_gaps     set account_id = p_canonical where account_id = p_absorbed;
  update info_gaps            set account_id = p_canonical where account_id = p_absorbed;
  update account_events       set account_id = p_canonical where account_id = p_absorbed;
  update account_stage_history set account_id = p_canonical where account_id = p_absorbed;
  update account_facts        set account_id = p_canonical where account_id = p_absorbed;
  update account_insights     set account_id = p_canonical where account_id = p_absorbed;
  update account_memory       set account_id = p_canonical where account_id = p_absorbed;
  update account_touches      set account_id = p_canonical where account_id = p_absorbed;
  update generated_content    set account_id = p_canonical where account_id = p_absorbed;
  update archived_content     set account_id = p_canonical where account_id = p_absorbed;
  update business_cases       set account_id = p_canonical where account_id = p_absorbed;
  update clay_enrichments     set account_id = p_canonical where account_id = p_absorbed;
  update deal_rooms           set account_id = p_canonical where account_id = p_absorbed;
  update hubspot_sync_log     set account_id = p_canonical where account_id = p_absorbed;
  update sdr_touches          set account_id = p_canonical where account_id = p_absorbed;
  update task_chats           set account_id = p_canonical where account_id = p_absorbed;
  update task_playbook_runs   set account_id = p_canonical where account_id = p_absorbed;
  update work_requests        set account_id = p_canonical where account_id = p_absorbed;
  update lead_pipeline        set account_id = p_canonical where account_id = p_absorbed;
  update daily_insights       set account_id = p_canonical where account_id = p_absorbed;
  update meeting_quality_scores set account_id = p_canonical where account_id = p_absorbed;

  -- Uniqueness-constrained tables: move only rows that will not collide, then drop the rest
  -- (canonical's existing row wins; a re-linked-call write-back backfill re-populates as needed).

  -- account_signals (PK account_id)
  update account_signals s set account_id = p_canonical
    where s.account_id = p_absorbed
      and not exists (select 1 from account_signals c where c.account_id = p_canonical);
  delete from account_signals where account_id = p_absorbed;

  -- account_threads (UNIQUE account_id)
  update account_threads t set account_id = p_canonical
    where t.account_id = p_absorbed
      and not exists (select 1 from account_threads c where c.account_id = p_canonical);
  delete from account_threads where account_id = p_absorbed;

  -- account_area_state (PK account_id, area_id)
  update account_area_state a set account_id = p_canonical
    where a.account_id = p_absorbed
      and not exists (select 1 from account_area_state c where c.account_id = p_canonical and c.area_id = a.area_id);
  delete from account_area_state where account_id = p_absorbed;

  -- account_pursuit_lists (UNIQUE user_id, account_id)
  update account_pursuit_lists a set account_id = p_canonical
    where a.account_id = p_absorbed
      and not exists (select 1 from account_pursuit_lists c where c.account_id = p_canonical and c.user_id = a.user_id);
  delete from account_pursuit_lists where account_id = p_absorbed;

  -- company_logos (UNIQUE account_id, logo_type)
  update company_logos a set account_id = p_canonical
    where a.account_id = p_absorbed
      and not exists (select 1 from company_logos c where c.account_id = p_canonical and c.logo_type = a.logo_type);
  delete from company_logos where account_id = p_absorbed;
end;
$$;
