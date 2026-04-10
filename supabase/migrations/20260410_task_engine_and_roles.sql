-- Task Engine & Role-Based Access
-- Created: 2026-04-10
-- Purpose: Add team roles to profiles, create task engine tables, update RLS for manager visibility

-- ===========================================
-- 1. PROFILES: ADD ROLE & TEAM_ID
-- ===========================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'rep' CHECK (role IN ('rep', 'manager', 'admin')),
  ADD COLUMN IF NOT EXISTS team_id uuid;
  -- team_id is nullable — no teams table yet, reserved for future grouping

COMMENT ON COLUMN public.profiles.role IS 'User role: rep (SDR/AE), manager (can view all team data), admin (full access)';
COMMENT ON COLUMN public.profiles.team_id IS 'Optional team grouping — teams table will be added in a future migration';

-- ===========================================
-- 2. HELPER FUNCTIONS FOR ROLE CHECKS
-- ===========================================

-- Returns true if the current user is a manager or admin.
-- Used in RLS policies across all tables.
-- SECURITY DEFINER so it runs with the function owner's privileges,
-- avoiding infinite recursion when policies on profiles call this.
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('manager', 'admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ===========================================
-- 3. UPDATE RLS POLICIES FOR ROLE-BASED ACCESS
-- ===========================================
-- Read access: managers/admins can see all data across the team.
-- Write access: unchanged — only the owning rep can mutate their own records.

-- Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view profiles" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_manager_or_admin()
  );

-- Accounts
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
CREATE POLICY "Users can view accounts" ON public.accounts
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_manager_or_admin()
  );

-- Transcripts
DROP POLICY IF EXISTS "Users can view own transcripts" ON public.transcripts;
CREATE POLICY "Users can view transcripts" ON public.transcripts
  FOR SELECT USING (
    account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    OR public.is_manager_or_admin()
  );

-- Stakeholders
DROP POLICY IF EXISTS "Users can view own stakeholders" ON public.stakeholders;
CREATE POLICY "Users can view stakeholders" ON public.stakeholders
  FOR SELECT USING (
    account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    OR public.is_manager_or_admin()
  );

-- Information Gaps
DROP POLICY IF EXISTS "Users can view own information_gaps" ON public.information_gaps;
CREATE POLICY "Users can view information_gaps" ON public.information_gaps
  FOR SELECT USING (
    account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    OR public.is_manager_or_admin()
  );

-- Notes
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
CREATE POLICY "Users can view notes" ON public.notes
  FOR SELECT USING (
    account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    OR public.is_manager_or_admin()
  );

-- ===========================================
-- 4. TASKS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Ownership & assignment
  owner_id    uuid REFERENCES auth.users ON DELETE SET NULL,   -- Who is responsible for completing this
  created_by  uuid REFERENCES auth.users ON DELETE SET NULL,   -- Who created it (may differ from owner)

  -- Classification
  type text NOT NULL CHECK (type IN ('triggered', 'assigned', 'recurring', 'project')),
  priority integer NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),  -- 1=high 2=medium 3=low

  -- Content
  title       text NOT NULL,
  description text,

  -- Status
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'complete', 'blocked')),

  -- Source tracking — what created this task
  source    text,   -- 'transcript_analysis' | 'stage_change' | 'manual' | 'recurring' | 'ai_suggestion'
  source_id uuid,   -- Polymorphic FK to the triggering entity (transcript, account, etc.) — no hard FK

  -- Account linkage (nullable — some tasks are not account-specific)
  account_id uuid REFERENCES public.accounts ON DELETE SET NULL,

  -- Scheduling
  due_date date,

  -- Whether this task is surfaced in the manager's team view
  visible_to_manager boolean NOT NULL DEFAULT true,

  -- Timestamps
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  completed_at timestamptz   -- auto-set by trigger when status → 'complete'
);

-- Indexes
CREATE INDEX IF NOT EXISTS tasks_owner_id_idx    ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS tasks_account_id_idx  ON public.tasks(account_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx      ON public.tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx    ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_type_idx        ON public.tasks(type);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx  ON public.tasks(created_at DESC);

-- updated_at trigger (reuses the function already defined in schema.sql)
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Auto-set completed_at when status changes to/from 'complete'
CREATE OR REPLACE FUNCTION public.handle_task_completion()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS DISTINCT FROM 'complete') THEN
    NEW.completed_at = now();
  ELSIF NEW.status != 'complete' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_set_completed_at ON public.tasks;
CREATE TRIGGER tasks_set_completed_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_task_completion();

-- ===========================================
-- 5. TASKS RLS
-- ===========================================

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Reps see tasks they own or created.
-- Managers/admins see all tasks.
CREATE POLICY "Task select" ON public.tasks
  FOR SELECT USING (
    auth.uid() = owner_id
    OR auth.uid() = created_by
    OR public.is_manager_or_admin()
  );

-- Anyone authenticated can create a task (they must be the creator).
CREATE POLICY "Task insert" ON public.tasks
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
  );

-- Owner, creator, and managers can update.
CREATE POLICY "Task update" ON public.tasks
  FOR UPDATE USING (
    auth.uid() = owner_id
    OR auth.uid() = created_by
    OR public.is_manager_or_admin()
  );

-- Only the creator or an admin can delete.
CREATE POLICY "Task delete" ON public.tasks
  FOR DELETE USING (
    auth.uid() = created_by
    OR public.is_manager_or_admin()
  );

-- ===========================================
-- 6. RECURRING TASK TEMPLATES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.recurring_task_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Template definition
  title       text NOT NULL,
  description text,
  type        text NOT NULL DEFAULT 'recurring',
  priority    integer NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),

  -- Assignment targeting
  -- assign_to_role: creates one task per user matching this role each cycle
  -- assign_to_user_id: overrides role — creates task for one specific person
  assign_to_role    text CHECK (assign_to_role IN ('rep', 'manager', 'admin', 'all')),
  assign_to_user_id uuid REFERENCES auth.users ON DELETE SET NULL,

  -- Schedule
  frequency    text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week  integer CHECK (day_of_week BETWEEN 0 AND 6),   -- 0=Sun … 6=Sat, used for weekly
  day_of_month integer CHECK (day_of_month BETWEEN 1 AND 31), -- used for monthly

  -- How many days before due date to create the task instance (0 = create on the due day)
  lead_days integer NOT NULL DEFAULT 0,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_templates_active_idx    ON public.recurring_task_templates(is_active);
CREATE INDEX IF NOT EXISTS recurring_templates_frequency_idx ON public.recurring_task_templates(frequency);

DROP TRIGGER IF EXISTS update_recurring_task_templates_updated_at ON public.recurring_task_templates;
CREATE TRIGGER update_recurring_task_templates_updated_at
  BEFORE UPDATE ON public.recurring_task_templates
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- RLS: all authenticated users can read templates; only managers/admins can write
ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read templates" ON public.recurring_task_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage templates" ON public.recurring_task_templates
  FOR ALL USING (public.is_manager_or_admin());

-- ===========================================
-- 7. SEED STANDARD RECURRING TASK TEMPLATES
-- ===========================================

INSERT INTO public.recurring_task_templates
  (title, description, priority, assign_to_role, frequency, day_of_week)
VALUES
  (
    'Weekly pipeline hygiene',
    'Review all active accounts: update stages, close stale deals, flag any account with no activity in 14+ days.',
    2, 'rep', 'weekly', 1  -- Monday
  ),
  (
    'HeyReach sequence review',
    'Check active LinkedIn sequences: review reply rates, pause underperforming campaigns, enroll new contacts from your target list.',
    2, 'rep', 'weekly', 1  -- Monday
  ),
  (
    'Check unanswered call promises',
    'Review transcripts from the past 7 days and find any commitments made on calls that have not been actioned yet.',
    1, 'rep', 'weekly', 2  -- Tuesday
  ),
  (
    'Weekly activity report',
    'Log your week: calls made, meetings booked, demos delivered. Submit to manager by EOD.',
    2, 'rep', 'weekly', 5  -- Friday
  ),
  (
    'Team pipeline review prep',
    'Pull deal updates for all active pursuit and later-stage accounts. Be ready to discuss status, blockers, and next steps.',
    1, 'manager', 'weekly', 4  -- Thursday
  )
ON CONFLICT DO NOTHING;

-- ===========================================
-- 8. OUTBOUND → PIPELINE BRIDGE COLUMN
-- ===========================================

-- When a company in the Outbound Engine is qualified and converted to an Account,
-- store the originating outbound company ID so the two records stay linked.
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS outbound_company_id text;

COMMENT ON COLUMN public.accounts.outbound_company_id IS
  'Client-side UUID of the Outbound Engine company this account was created from via the Qualify → Create Account flow. Null if account was created directly in the pipeline.';

CREATE INDEX IF NOT EXISTS accounts_outbound_company_id_idx
  ON public.accounts(outbound_company_id)
  WHERE outbound_company_id IS NOT NULL;

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE public.tasks IS
  'Task engine: all actionable work items for the sales team. Every insight the platform generates should produce a task here.';
COMMENT ON COLUMN public.tasks.type IS
  'triggered = auto-created by a system event | assigned = one person gave another person work | recurring = spawned from a template on schedule | project = ongoing multi-step work';
COMMENT ON COLUMN public.tasks.priority IS '1 = high, 2 = medium, 3 = low';
COMMENT ON COLUMN public.tasks.source IS
  'What created this task: transcript_analysis, stage_change, manual, recurring, ai_suggestion';
COMMENT ON COLUMN public.tasks.source_id IS
  'Polymorphic reference to the triggering entity (transcript ID, account ID, etc.). No hard FK — look up by source + source_id.';

COMMENT ON TABLE public.recurring_task_templates IS
  'Defines the standard recurring tasks the daily digest creates as task instances on each cycle. Every recurring task should have a long-term goal of being automated away entirely.';
