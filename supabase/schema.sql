-- Supabase Schema for Sales Dashboard
-- Run this in your Supabase SQL Editor

-- ===========================================
-- TABLES
-- ===========================================

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Accounts (main entity)
create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  url text,
  stage text default 'qualifying',
  vertical text,
  ownership_type text,
  business_areas jsonb default '{}',
  meddicc jsonb default '{}',
  metrics jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Transcripts
create table if not exists public.transcripts (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts on delete cascade not null,
  text text not null,
  date date,
  call_type text default 'other',
  attendees text[] default '{}',
  summary text,
  raw_analysis jsonb,
  source text,
  gong_call_id text,
  gong_url text,
  created_at timestamptz default now()
);

-- Stakeholders
create table if not exists public.stakeholders (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts on delete cascade not null,
  name text not null,
  title text,
  department text,
  role text default 'Unknown',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Information Gaps
create table if not exists public.information_gaps (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts on delete cascade not null,
  question text not null,
  category text default 'business',
  meddicc_category text,
  status text default 'open',
  resolution text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- Notes
create table if not exists public.notes (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references public.accounts on delete cascade not null,
  category text default 'General',
  content text not null,
  created_at timestamptz default now()
);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transcripts enable row level security;
alter table public.stakeholders enable row level security;
alter table public.information_gaps enable row level security;
alter table public.notes enable row level security;

-- Profiles: users can only see/edit their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Accounts: users can only access their own accounts
create policy "Users can view own accounts" on public.accounts
  for select using (auth.uid() = user_id);
create policy "Users can insert own accounts" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts" on public.accounts
  for update using (auth.uid() = user_id);
create policy "Users can delete own accounts" on public.accounts
  for delete using (auth.uid() = user_id);

-- Transcripts: access through account ownership
create policy "Users can view own transcripts" on public.transcripts
  for select using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can insert own transcripts" on public.transcripts
  for insert with check (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can update own transcripts" on public.transcripts
  for update using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can delete own transcripts" on public.transcripts
  for delete using (account_id in (select id from public.accounts where user_id = auth.uid()));

-- Stakeholders: access through account ownership
create policy "Users can view own stakeholders" on public.stakeholders
  for select using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can insert own stakeholders" on public.stakeholders
  for insert with check (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can update own stakeholders" on public.stakeholders
  for update using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can delete own stakeholders" on public.stakeholders
  for delete using (account_id in (select id from public.accounts where user_id = auth.uid()));

-- Information Gaps: access through account ownership
create policy "Users can view own information_gaps" on public.information_gaps
  for select using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can insert own information_gaps" on public.information_gaps
  for insert with check (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can update own information_gaps" on public.information_gaps
  for update using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can delete own information_gaps" on public.information_gaps
  for delete using (account_id in (select id from public.accounts where user_id = auth.uid()));

-- Notes: access through account ownership
create policy "Users can view own notes" on public.notes
  for select using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can insert own notes" on public.notes
  for insert with check (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can update own notes" on public.notes
  for update using (account_id in (select id from public.accounts where user_id = auth.uid()));
create policy "Users can delete own notes" on public.notes
  for delete using (account_id in (select id from public.accounts where user_id = auth.uid()));

-- ===========================================
-- INDEXES
-- ===========================================

create index if not exists accounts_user_id_idx on public.accounts(user_id);
create index if not exists transcripts_account_id_idx on public.transcripts(account_id);
create index if not exists stakeholders_account_id_idx on public.stakeholders(account_id);
create index if not exists information_gaps_account_id_idx on public.information_gaps(account_id);
create index if not exists information_gaps_status_idx on public.information_gaps(status);
create index if not exists notes_account_id_idx on public.notes(account_id);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to automatically create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call handle_new_user on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
drop trigger if exists update_accounts_updated_at on public.accounts;
create trigger update_accounts_updated_at
  before update on public.accounts
  for each row execute procedure public.update_updated_at_column();

drop trigger if exists update_stakeholders_updated_at on public.stakeholders;
create trigger update_stakeholders_updated_at
  before update on public.stakeholders
  for each row execute procedure public.update_updated_at_column();
