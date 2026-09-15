-- 015_guest_members.sql
-- Companions without an account (長輩 with no email, or who never joins) are
-- trip_members rows keyed guest:<uuid> instead of an email. Fork groups, the
-- overview filter and the share text all key on that column, so they pick
-- guests up unchanged.
--
-- A guest key has no @, so it never equals auth.email(): is_trip_member (004)
-- stays false for it, and a guest row grants nobody access to the trip.
-- 014 lives on feat/event-links, hence 015.

drop policy if exists "trip_members_add_guest" on trip_members;

create policy "trip_members_add_guest" on trip_members
  for insert to authenticated
  with check (
    public.is_trip_member(trip_id)
    and user_email like 'guest:%'
    and position('@' in user_email) = 0
  );

-- Any member may remove a guest; removing a real member stays owner-only (003).
drop policy if exists "trip_members_remove_guest" on trip_members;

create policy "trip_members_remove_guest" on trip_members
  for delete to authenticated
  using (public.is_trip_member(trip_id) and user_email like 'guest:%');
