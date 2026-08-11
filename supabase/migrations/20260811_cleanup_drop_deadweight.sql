-- Aggressive DB cleanup (James, 2026-08-11): drop foreign-app tables + dead/legacy/half-built dashboard
-- tables so the schema is simple to navigate. Verified: none are referenced by live sales-dashboard
-- code; account_rollups (the brief's view) reads transcripts/stakeholders/gaps, NOT these. CASCADE
-- handles the interlinked FKs (upc_reports→upc_products; fact tables→attribute_schema;
-- account_area_state→business_areas) + the dependent UPC views.

-- Foreign apps (firearms / UPC) — confirmed those apps run on their own database now.
drop view  if exists public.upc_pending_queue  cascade;
drop view  if exists public.upc_report_queue   cascade;
drop table if exists public.upc_reports        cascade;
drop table if exists public.upc_products       cascade;
drop table if exists public.gun_ranges         cascade;
drop table if exists public.shooting_drills    cascade;
drop table if exists public.load_recipes       cascade;
drop table if exists public.user_profiles      cascade;  -- duplicate of profiles

-- Dead / legacy dashboard tables (empty + superseded, 0 code refs)
drop table if exists public.account_pursuit_lists   cascade;  -- superseded by sdr_touches
drop table if exists public.account_touches         cascade;  -- superseded by sdr_touches
drop table if exists public.meeting_quality_scores  cascade;  -- never shipped
drop table if exists public.business_cases          cascade;  -- empty, unused
drop table if exists public.info_gaps               cascade;  -- legacy dup of information_gaps

-- Half-built normalized substrate (scaffolded, never wired to the UI)
drop table if exists public.account_events      cascade;
drop table if exists public.account_insights    cascade;
drop table if exists public.account_threads     cascade;
drop table if exists public.account_area_state  cascade;
drop table if exists public.business_areas      cascade;  -- taxonomy also lives as a code constant

-- Fact graph (dead — lib/db/facts.js has no live importer)
drop table if exists public.account_facts               cascade;
drop table if exists public.stakeholder_facts           cascade;
drop table if exists public.fact_conflicts_log          cascade;
drop table if exists public.fact_resolution_rules       cascade;
drop table if exists public.attribute_schema_proposals  cascade;
drop table if exists public.attribute_schema            cascade;

-- Orphaned Google-Drive-era content table (Content Studio uses the browser; unused server-side)
drop table if exists public.generated_content cascade;
