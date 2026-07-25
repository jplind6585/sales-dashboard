-- Banner comparison-pages content model (public SEO/GEO marketing pages).
-- Lives in the shared "Sales AI Brain" project, namespaced cmp_*. The AI drafter reads the internal
-- competitor intel (sales_process_config.competitor_playbook / winning_tactics / icp_definition) to
-- populate these. Public reads are server-side via service role; RLS gives defense-in-depth so the
-- anon key can only ever see PUBLISHED pages.

create extension if not exists pgcrypto;

-- Competitors (reference data; one row per competitor). Rich fields filled by AI draft + review.
create table if not exists cmp_competitors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text,                              -- e.g. "construction PM", "real-estate CapEx"
  logo_url text,
  positioning text,                           -- what they're known for
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  pricing_model text,
  best_for text,
  founded text,
  source_urls jsonb not null default '[]'::jsonb,  -- citations for factual claims
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Banner's canonical product facts — the constant side of every comparison. Versioned singleton.
create table if not exists cmp_banner_facts (
  id uuid primary key default gen_random_uuid(),
  version int not null default 1,
  facts jsonb not null default '{}'::jsonb,   -- {tagline, category, value_props[], features[], icp, proof_points[], pricing_stance}
  updated_at timestamptz not null default now(),
  updated_by text
);

-- The publishable unit: a comparison / alternatives / listicle / category / feature page.
create table if not exists cmp_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  type text not null check (type in ('vs','alternatives','listicle','category','feature')),
  competitor_id uuid references cmp_competitors(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','review','published')),
  title text,
  meta_title text,
  meta_description text,
  canonical text,
  hero jsonb not null default '{}'::jsonb,    -- {headline, subhead, verdict}
  body jsonb not null default '[]'::jsonb,    -- ordered blocks: feature_matrix, prose, pros_cons, pricing, migration, quotes
  faq jsonb not null default '[]'::jsonb,     -- [{q,a}]
  schema_overrides jsonb not null default '{}'::jsonb,
  og_image_url text,
  author text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cmp_pages_status on cmp_pages(status);
create index if not exists idx_cmp_pages_type on cmp_pages(type);
create index if not exists idx_cmp_pages_competitor on cmp_pages(competitor_id);

-- Snapshot on every save — rollback + factual-claim audit trail (mirrors sales_process_config_history).
create table if not exists cmp_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references cmp_pages(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by text
);

-- ── RLS: anon can read published pages + reference data only; writes are service-role (admin app) ──
alter table cmp_competitors enable row level security;
alter table cmp_banner_facts enable row level security;
alter table cmp_pages enable row level security;
alter table cmp_page_revisions enable row level security;

drop policy if exists cmp_pages_public_read on cmp_pages;
create policy cmp_pages_public_read on cmp_pages for select using (status = 'published');

drop policy if exists cmp_competitors_public_read on cmp_competitors;
create policy cmp_competitors_public_read on cmp_competitors for select using (true);

drop policy if exists cmp_banner_facts_public_read on cmp_banner_facts;
create policy cmp_banner_facts_public_read on cmp_banner_facts for select using (true);
-- cmp_page_revisions: no anon policy => anon denied; service role bypasses RLS for the admin app.

-- ── Seed: target competitor list (rich content filled later by AI draft + review) ──
insert into cmp_competitors (slug, name, category) values
  ('procore',    'Procore',                     'Construction management'),
  ('yardi-cm',   'Yardi Construction Manager',  'Real-estate / CapEx'),
  ('northspyre', 'Northspyre',                  'Real-estate development / CapEx'),
  ('ingenious',  'Ingenious.build',             'Construction finance'),
  ('rabbet',     'Rabbet',                      'Construction finance / draw management'),
  ('smartsheet', 'Smartsheet',                  'Flexible work management')
on conflict (slug) do nothing;

-- ── Seed: starter Banner facts (the AI drafter enriches from icp_definition / winning_tactics) ──
insert into cmp_banner_facts (facts, updated_by)
select '{
  "tagline": "CapEx management, purpose-built.",
  "category": "CapEx management software",
  "value_props": [
    "Purpose-built for CapEx — no configuration or maintenance, pre-built for capital projects",
    "Financial-grade reporting spreadsheets and generic PM tools can''t produce",
    "Plan, approve, and track capital spend in one place"
  ],
  "icp": "CRE / real-estate and asset-heavy teams managing capital projects",
  "proof_points": [],
  "pricing_stance": "Transparent, value-based"
}'::jsonb, 'seed'
where not exists (select 1 from cmp_banner_facts);
