-- Add slack_channel column to accounts table
-- This stores an explicit Slack channel override for an account (e.g. "#udr-inc")
-- If null, the channel is derived from the account name at send time

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS slack_channel TEXT;

COMMENT ON COLUMN accounts.slack_channel IS
  'Optional Slack channel override for this account (e.g. #udr-inc). '
  'If null, channel is derived from account name at notification time.';
