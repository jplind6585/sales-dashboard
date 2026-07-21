-- role / rep_type are admin-assigned ONLY. Two RLS policies on profiles still let a rep write
-- their own row on any column from the browser (anon key + their own JWT) — i.e. self-escalate to
-- role='admin'. Drop both. All legitimate profile writes go through service-role API routes, and
-- provisioning is done by the SECURITY DEFINER handle_new_user trigger — neither needs these.
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

-- Ensure the provisioning trigger exists. 00_drop_all drops it with the function (CASCADE); the
-- rep_type migration only recreated the function, so a rebuild-from-scratch would silently stop
-- provisioning. Recreate idempotently so the schema doesn't depend on out-of-band dashboard state.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
