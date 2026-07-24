-- Step C: Tasks v2 net-new. Additive to the existing tasks table (which already has primary_action,
-- rationale, source_type, snooze_until, dismissed_at, ai_draft). Adds the priority score, richer source
-- metadata, and the DB-backed three-layer chat (account thread + per-task chat) that replaces the
-- current localStorage Work-in-Claude persistence.

alter table tasks
  add column if not exists ai_priority_score float,
  add column if not exists source_metadata jsonb,
  add column if not exists stakeholder_id uuid references stakeholders(id),
  add column if not exists estimated_minutes int,
  add column if not exists fire_count int default 1,
  add column if not exists parent_task_id uuid references tasks(id),
  add column if not exists playbook_step_id uuid;
create index if not exists tasks_priority_idx on tasks (owner_id, status, ai_priority_score desc);

-- Layer 2: one living narrative per account
create table if not exists account_threads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade unique not null,
  deal_arc_summary text,
  recent_activity text,
  open_questions text,
  current_blockers text,
  next_meaningful_step text,
  last_regenerated_at timestamptz,
  generation_version int default 1,
  updated_at timestamptz default now()
);

-- Layer 3: per-task chat (replaces wic_<taskId> localStorage)
create table if not exists task_chats (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade unique not null,
  account_id uuid references accounts(id),
  system_prompt text,
  status text default 'active' check (status in ('active','archived')),
  created_at timestamptz default now(),
  archived_at timestamptz
);
create table if not exists task_chat_messages (
  id uuid primary key default gen_random_uuid(),
  task_chat_id uuid references task_chats(id) on delete cascade not null,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists task_chat_messages_idx on task_chat_messages (task_chat_id, created_at);

-- Playbook steps (task_playbooks already exists; this completes the pair)
create table if not exists playbook_steps (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid references task_playbooks(id) on delete cascade,
  step_order int,
  title text,
  description text,
  assigned_role text,
  due_offset_days int,
  primary_action jsonb,
  is_active boolean default true
);
