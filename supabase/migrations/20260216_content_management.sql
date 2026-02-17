-- Content Management Tables
-- Created: 2026-02-16
-- Purpose: Store content templates and generated content for sales materials

-- Content Templates Table
-- Stores metadata about available templates (actual template content is in code)
CREATE TABLE IF NOT EXISTS content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- '1-pager', 'sales-deck', 'integration-guide', etc.
  version TEXT NOT NULL, -- 'enterprise', 'mid-market', 'case-study', etc.
  description TEXT,
  category TEXT, -- For grouping (e.g., 'integration-yardi', 'integration-mri')
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- Store template-specific config
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated Content Table
-- Tracks all content generated and exported to Google Drive
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  template_id UUID REFERENCES content_templates(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL, -- '1-pager', 'sales-deck', 'integration-guide'
  template_version TEXT, -- Which version was used
  title TEXT NOT NULL,

  -- Google Drive integration
  drive_file_id TEXT, -- Google Drive file ID
  drive_file_url TEXT, -- Full URL to access the file
  drive_folder_id TEXT, -- Which subfolder it's in
  drive_file_type TEXT, -- 'document', 'presentation', 'spreadsheet'

  -- Content metadata
  data_snapshot JSONB DEFAULT '{}', -- Store input data used for generation
  generation_metadata JSONB DEFAULT '{}', -- Store which data sources were used

  -- Status tracking
  status TEXT DEFAULT 'draft', -- 'draft', 'generated', 'exported', 'shared'
  export_status TEXT, -- 'pending', 'success', 'failed'
  export_error TEXT, -- Store any export errors

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  exported_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(type);
CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_generated_content_account ON generated_content(account_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_user ON generated_content(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_type ON generated_content(content_type);
CREATE INDEX IF NOT EXISTS idx_generated_content_created ON generated_content(created_at DESC);

-- Updated_at trigger for content_templates
CREATE OR REPLACE FUNCTION update_content_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_templates_updated_at
BEFORE UPDATE ON content_templates
FOR EACH ROW
EXECUTE FUNCTION update_content_templates_updated_at();

-- Updated_at trigger for generated_content
CREATE OR REPLACE FUNCTION update_generated_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generated_content_updated_at
BEFORE UPDATE ON generated_content
FOR EACH ROW
EXECUTE FUNCTION update_generated_content_updated_at();

-- Seed initial templates
-- 1-Pagers
INSERT INTO content_templates (name, type, version, description, category) VALUES
  ('Enterprise 1-Pager', '1-pager', 'enterprise', 'Comprehensive 1-page overview for enterprise clients', 'standard'),
  ('Mid-Market 1-Pager', '1-pager', 'mid-market', 'Simplified 1-page overview for mid-market clients', 'standard'),
  ('Case Study', '1-pager', 'case-study', 'Customer success story format', 'standard'),
  ('ROI-Focused 1-Pager', '1-pager', 'roi-focused', 'Value proposition with ROI calculator', 'standard');

-- Sales Decks
INSERT INTO content_templates (name, type, version, description, category) VALUES
  ('Intro Deck', 'sales-deck', 'intro', 'Initial meeting presentation', 'standard'),
  ('Demo/Follow-up Deck', 'sales-deck', 'demo', 'Product demo and deep-dive presentation', 'standard'),
  ('Proposal Deck', 'sales-deck', 'proposal', 'Formal proposal presentation', 'standard');

-- Integration Guides - 1-Pager Versions
INSERT INTO content_templates (name, type, version, description, category) VALUES
  ('Yardi Integration', 'integration-guide', '1-pager', 'Yardi integration overview (1-page)', 'integration-yardi'),
  ('MRI Integration', 'integration-guide', '1-pager', 'MRI integration overview (1-page)', 'integration-mri'),
  ('Real Page Integration', 'integration-guide', '1-pager', 'Real Page integration overview (1-page)', 'integration-realpage'),
  ('Appfolio Integration', 'integration-guide', '1-pager', 'Appfolio integration overview (1-page)', 'integration-appfolio'),
  ('Resman Integration', 'integration-guide', '1-pager', 'Resman integration overview (1-page)', 'integration-resman'),
  ('Entrata Integration', 'integration-guide', '1-pager', 'Entrata integration overview (1-page)', 'integration-entrata'),
  ('Oracle Integration', 'integration-guide', '1-pager', 'Oracle integration overview (1-page)', 'integration-oracle'),
  ('Sage Integration', 'integration-guide', '1-pager', 'Sage integration overview (1-page)', 'integration-sage');

-- Integration Guides - Slide Versions
INSERT INTO content_templates (name, type, version, description, category) VALUES
  ('Yardi Integration Slides', 'integration-guide', 'slides', 'Yardi integration slides for decks', 'integration-yardi'),
  ('MRI Integration Slides', 'integration-guide', 'slides', 'MRI integration slides for decks', 'integration-mri'),
  ('Real Page Integration Slides', 'integration-guide', 'slides', 'Real Page integration slides for decks', 'integration-realpage'),
  ('Appfolio Integration Slides', 'integration-guide', 'slides', 'Appfolio integration slides for decks', 'integration-appfolio'),
  ('Resman Integration Slides', 'integration-guide', 'slides', 'Resman integration slides for decks', 'integration-resman'),
  ('Entrata Integration Slides', 'integration-guide', 'slides', 'Entrata integration slides for decks', 'integration-entrata'),
  ('Oracle Integration Slides', 'integration-guide', 'slides', 'Oracle integration slides for decks', 'integration-oracle'),
  ('Sage Integration Slides', 'integration-guide', 'slides', 'Sage integration slides for decks', 'integration-sage');

-- Company Logos Table
-- Stores references to uploaded company logos
CREATE TABLE IF NOT EXISTS company_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  logo_type TEXT NOT NULL, -- 'full-logo', 'icon', 'stacked', 'single-color', 'full-color'

  -- Google Drive references
  drive_file_id TEXT NOT NULL,
  drive_file_url TEXT,
  drive_direct_url TEXT, -- Direct download URL

  -- File metadata
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER,

  -- Timestamps
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one logo type per company
  UNIQUE(account_id, logo_type)
);

-- Archived Content Table
-- Tracks content that has been archived
CREATE TABLE IF NOT EXISTS archived_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_content_id UUID, -- Reference to generated_content (may be null if content was deleted)
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  content_type TEXT,
  title TEXT,

  -- Archive details
  archived_reason TEXT, -- 'age', 'replaced', 'manual'
  archived_from_folder TEXT, -- Original Drive folder
  archive_year_month TEXT, -- e.g., '2026-02'

  -- Google Drive references
  drive_file_id TEXT,
  drive_file_url TEXT,
  archive_folder_id TEXT,

  -- Cleanup tracking
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  scheduled_deletion_at TIMESTAMP WITH TIME ZONE, -- When it should be deleted (12 months from archive)

  -- Timestamps
  original_created_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_logos_account ON company_logos(account_id);
CREATE INDEX IF NOT EXISTS idx_company_logos_company_name ON company_logos(company_name);
CREATE INDEX IF NOT EXISTS idx_company_logos_type ON company_logos(logo_type);
CREATE INDEX IF NOT EXISTS idx_archived_content_account ON archived_content(account_id);
CREATE INDEX IF NOT EXISTS idx_archived_content_year_month ON archived_content(archive_year_month);
CREATE INDEX IF NOT EXISTS idx_archived_content_scheduled_deletion ON archived_content(scheduled_deletion_at);

-- Updated_at trigger for company_logos
CREATE OR REPLACE FUNCTION update_company_logos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_logos_updated_at
BEFORE UPDATE ON company_logos
FOR EACH ROW
EXECUTE FUNCTION update_company_logos_updated_at();

-- Comments
COMMENT ON TABLE content_templates IS 'Metadata about available content templates';
COMMENT ON TABLE generated_content IS 'Tracks all generated content instances and their Google Drive links';
COMMENT ON COLUMN generated_content.data_snapshot IS 'Stores the input data used to generate this content';
COMMENT ON COLUMN generated_content.generation_metadata IS 'Tracks which data sources were used (transcripts, manual input, etc)';
COMMENT ON TABLE company_logos IS 'Stores company logo files for use in generated content';
COMMENT ON TABLE archived_content IS 'Tracks archived content for cleanup and audit purposes';
