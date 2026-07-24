-- Step B: the fact graph (spec 01), built ADDITIVELY. Flat tables stay the read model for now; facts
-- are written alongside and consumers migrate later (Step E). EAV so new attributes are config, not migrations.

create table if not exists attribute_schema (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  entity_type text not null check (entity_type in ('account','stakeholder')),
  category text not null,
  display_name text not null,
  description text,
  value_type text not null check (value_type in ('number','currency','string','text','enum','enum_array','string_array','boolean','date','daterange')),
  enum_options jsonb,
  unit text,
  ai_extraction_hints text,
  multi_value_allowed boolean default false,
  conflicts_require_admin boolean default false,
  decay_window interval,
  decay_behavior text default 'reconfirm' check (decay_behavior in ('reconfirm','archive','flag_only')),
  is_sensitive boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists account_facts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade not null,
  attribute_key text references attribute_schema(key) not null,
  value jsonb not null,
  normalized_value text,
  source_type text not null check (source_type in ('call','email','manual','document','enrichment','admin','system')),
  source_id text,
  source_speaker_id uuid references stakeholders(id),
  source_excerpt text,
  captured_at timestamptz not null,
  captured_by uuid,
  confidence float,
  status text not null default 'active' check (status in ('active','disputed','superseded','admin_resolved','archived','rejected')),
  last_confirmed_at timestamptz,
  confirmation_count int default 1,
  needs_reconfirmation boolean default false,
  resolved_by uuid,
  resolution_notes text,
  superseded_by uuid references account_facts(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists account_facts_lookup on account_facts (account_id, attribute_key, status);
create index if not exists account_facts_review on account_facts (status) where status in ('disputed','needs_reconfirmation');

create table if not exists stakeholder_facts (
  id uuid primary key default gen_random_uuid(),
  stakeholder_id uuid references stakeholders(id) on delete cascade not null,
  attribute_key text references attribute_schema(key) not null,
  value jsonb not null,
  normalized_value text,
  source_type text not null check (source_type in ('call','email','manual','document','enrichment','admin','system')),
  source_id text,
  source_speaker_id uuid references stakeholders(id),
  source_excerpt text,
  captured_at timestamptz not null,
  captured_by uuid,
  confidence float,
  status text not null default 'active' check (status in ('active','disputed','superseded','admin_resolved','archived','rejected')),
  last_confirmed_at timestamptz,
  confirmation_count int default 1,
  needs_reconfirmation boolean default false,
  superseded_by uuid references stakeholder_facts(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists stakeholder_facts_lookup on stakeholder_facts (stakeholder_id, attribute_key, status);

create table if not exists attribute_schema_proposals (
  id uuid primary key default gen_random_uuid(),
  proposed_key text not null,
  entity_type text not null,
  category text,
  value_type text,
  example_value jsonb,
  example_source_type text,
  example_source_id text,
  example_excerpt text,
  rationale text,
  proposed_at timestamptz default now(),
  proposed_by text default 'ai_extraction',
  status text default 'pending' check (status in ('pending','approved','rejected','merged')),
  reviewed_by uuid,
  review_notes text,
  approved_as_key text,
  merged_into_key text
);

create table if not exists fact_resolution_rules (
  id uuid primary key default gen_random_uuid(),
  attribute_key text references attribute_schema(key),
  rule_type text check (rule_type in ('highest_role','most_recent','highest_confidence','admin_required')),
  rule_config jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Backfill conflict log (James chose "suppress + summarize": store conflicts here, do NOT spawn tasks).
create table if not exists fact_conflicts_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  attribute_key text not null,
  values jsonb not null,
  detected_at timestamptz default now(),
  resolved boolean default false
);

-- Seed vocabulary (spec 01). Additive; safe to re-run.
insert into attribute_schema (key, entity_type, category, display_name, value_type, enum_options, unit, multi_value_allowed, conflicts_require_admin, decay_window) values
  ('portfolio.unit_count','account','portfolio','Portfolio Unit Count','number',null,'units',false,false,interval '18 months'),
  ('portfolio.asset_class','account','portfolio','Asset Class','enum_array','["multifamily","hospitality","office","industrial","retail","senior_living","student_housing","mixed_use","other"]',null,false,false,interval '18 months'),
  ('portfolio.geographies','account','portfolio','Geographies','string_array',null,null,false,false,interval '18 months'),
  ('portfolio.owned_vs_managed','account','portfolio','Owned vs Managed','enum','["owned","managed","both"]',null,false,false,interval '18 months'),
  ('portfolio.aum','account','portfolio','AUM','currency',null,'USD',false,false,interval '18 months'),
  ('portfolio.recent_acquisitions','account','portfolio','Recent Acquisitions','text',null,null,true,false,interval '18 months'),
  ('tech_stack.accounting_system','account','tech_stack','Accounting System','enum','["yardi","mri","entrata","appfolio","realpage","other","none"]',null,false,false,interval '12 months'),
  ('tech_stack.pm_system','account','tech_stack','PM System','enum_array',null,null,false,false,interval '12 months'),
  ('tech_stack.construction_tools','account','tech_stack','Construction Tools','string_array',null,null,true,false,interval '12 months'),
  ('tech_stack.current_capex_tracking_method','account','tech_stack','Current CapEx Tracking','enum','["excel","smartsheet","procore","northspyre","custom_built","other","ad_hoc"]',null,false,false,interval '12 months'),
  ('tech_stack.integrations_required','account','tech_stack','Integrations Required','string_array',null,null,true,false,interval '12 months'),
  ('pain.stated_pains','account','pain','Stated Pains','text',null,null,true,false,interval '6 months'),
  ('pain.quantified_status_quo_cost','account','pain','Quantified Status-Quo Cost','currency',null,'USD',false,false,interval '6 months'),
  ('pain.bandwidth_recovery_estimate','account','pain','Bandwidth Recovery Estimate','text',null,null,false,false,interval '6 months'),
  ('pain.process_failures_described','account','pain','Process Failures Described','text',null,null,true,false,interval '6 months'),
  ('process.budget_cycle_timing','account','process','Budget Cycle Timing','string',null,null,false,false,interval '18 months'),
  ('process.decision_criteria','account','process','Decision Criteria','string_array',null,null,true,false,null),
  ('process.evaluation_timeline','account','process','Evaluation Timeline','string',null,null,false,false,interval '90 days'),
  ('process.procurement_requirements','account','process','Procurement Requirements','text',null,null,false,false,null),
  ('process.security_review_required','account','process','Security Review Required','boolean',null,null,false,false,null),
  ('commercial.annual_capex_volume','account','commercial','Annual CapEx Volume','currency',null,'USD',false,false,interval '12 months'),
  ('commercial.deal_size_potential','account','commercial','Deal Size Potential','currency',null,'USD',false,false,interval '12 months'),
  ('commercial.contract_preferences','account','commercial','Contract Preferences','text',null,null,false,false,null),
  ('competitive.incumbent_solution','account','competitive','Incumbent Solution','enum_array',null,null,false,true,interval '12 months'),
  ('competitive.evaluating_alternatives','account','competitive','Evaluating Alternatives','string_array',null,null,true,false,interval '60 days'),
  ('competitive.prior_tools_tried','account','competitive','Prior Tools Tried','string_array',null,null,true,false,null),
  ('competitive.disqualifiers_against_us','account','competitive','Disqualifiers Against Us','text',null,null,true,false,null),
  ('context.recent_leadership_changes','account','context','Recent Leadership Changes','text',null,null,true,false,interval '12 months'),
  ('context.recent_acquisitions_or_dispositions','account','context','Recent Acquisitions/Dispositions','text',null,null,true,false,interval '12 months'),
  ('context.organizational_initiatives','account','context','Organizational Initiatives','text',null,null,true,false,interval '12 months'),
  ('relationship.communication_preference','stakeholder','relationship','Communication Preference','enum','["email","phone","slack","in_person","mixed"]',null,false,false,null),
  ('relationship.meeting_cadence_preference','stakeholder','relationship','Meeting Cadence Preference','string',null,null,false,false,null),
  ('relationship.responsiveness','stakeholder','relationship','Responsiveness','enum','["fast","normal","slow","unresponsive"]',null,false,false,null),
  ('personal.background','stakeholder','personal','Background','text',null,null,true,true,interval '24 months'),
  ('personal.interests','stakeholder','personal','Interests','string_array',null,null,true,false,interval '24 months'),
  ('personal.priorities','stakeholder','personal','Priorities','text',null,null,true,true,interval '24 months'),
  ('personal.nuggets','stakeholder','personal','Nuggets','text',null,null,true,true,interval '24 months'),
  ('process.role_on_deal','stakeholder','process','Role on Deal','enum','["economic_buyer","champion","user","influencer","blocker","gatekeeper","technical_evaluator","unknown"]',null,false,false,null),
  ('process.authority_level','stakeholder','process','Authority Level','enum','["full","partial","none","unknown"]',null,false,false,null)
on conflict (key) do nothing;
