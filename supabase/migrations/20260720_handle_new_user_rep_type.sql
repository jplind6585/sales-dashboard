-- Provision role + rep_type from invite metadata.
-- Admins assign SDR/AE at invite time via inviteUserByEmail(email, { data: { role, rep_type } }).
-- The on_auth_user_created trigger runs handle_new_user() on signup and previously copied only
-- name/avatar, so the assigned rep_type was silently dropped. Copy it (and role) onto the profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role, rep_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'rep'),
    new.raw_user_meta_data->>'rep_type'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
