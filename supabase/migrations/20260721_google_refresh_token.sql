-- Durable Google Calendar access for the pre-call prep cron: store the OAuth refresh token so the
-- server can mint fresh access tokens without the user re-signing in. Service-role only in practice
-- (never selected by client code / the /api/me allowlist). Nullable — populated on next sign-in.
alter table public.profiles add column if not exists google_refresh_token text;
