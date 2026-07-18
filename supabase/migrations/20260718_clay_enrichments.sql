-- Wave integrations M5 (2026-07-18): store enriched records Clay posts back via its HTTP-API column.
CREATE TABLE IF NOT EXISTS clay_enrichments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   text,
  account_id  uuid REFERENCES accounts(id),
  data        jsonb,
  received_at timestamptz DEFAULT now()
);
ALTER TABLE clay_enrichments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clay_enrichments_rw ON clay_enrichments;
CREATE POLICY clay_enrichments_rw ON clay_enrichments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_clay_enrichments_record ON clay_enrichments(record_id);
