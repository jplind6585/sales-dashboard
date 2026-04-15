-- Add slack_user_id to profiles so daily digests can DM each rep directly
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

COMMENT ON COLUMN profiles.slack_user_id IS
  'Slack Member ID for this user (e.g. U01234567). '
  'Found in Slack: click your profile photo → 3 dots → Copy member ID. '
  'Used to send the daily digest as a direct message.';
