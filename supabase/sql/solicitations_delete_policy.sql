-- Only the creator of a solicitation, or a superadmin, may delete it.
-- Run in the Supabase SQL editor (safe to re-run).
--
-- This is a RESTRICTIVE policy, so it is ANDed with the existing permissive
-- "Authenticated users can CRUD solicitations" policy: reads, inserts and
-- updates are unchanged, and deletes additionally need this check to pass.
-- The profiles lookup works because users can read their own profile row.

drop policy if exists "Only creator or superadmin can delete solicitations" on public.solicitations;
create policy "Only creator or superadmin can delete solicitations"
  on public.solicitations
  as restrictive
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'superadmin'
    )
  );
