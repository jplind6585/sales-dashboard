-- Stage change audit log — auto-populated by trigger on accounts table
CREATE TABLE IF NOT EXISTS account_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  account_name TEXT,
  owner_name TEXT,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  deal_value_at_change NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_stage_history_account_id ON account_stage_history(account_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at ON account_stage_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_history_to_stage ON account_stage_history(to_stage);

-- Auto-capture every stage change on the accounts table
CREATE OR REPLACE FUNCTION fn_record_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO account_stage_history (
      account_id, account_name, owner_name,
      from_stage, to_stage, deal_value_at_change
    ) VALUES (
      NEW.id, NEW.name, NEW.owner_name,
      OLD.stage, NEW.stage, NEW.deal_value
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stage_change ON accounts;
CREATE TRIGGER trg_stage_change
  AFTER UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION fn_record_stage_change();
