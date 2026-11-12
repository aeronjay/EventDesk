-- Returns the email of each given user id, for showing who created a record.
-- Run in the Supabase SQL editor (safe to re-run).
--
-- profiles RLS only lets users read their own row, so this function runs as
-- its owner (security definer) and exposes nothing but id and email, and only
-- to signed-in users.

create or replace function public.get_user_emails(user_ids uuid[])
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email
  from public.profiles p
  where p.id = any(user_ids)
    and auth.uid() is not null
$$;

revoke execute on function public.get_user_emails(uuid[]) from public, anon;
grant execute on function public.get_user_emails(uuid[]) to authenticated;
