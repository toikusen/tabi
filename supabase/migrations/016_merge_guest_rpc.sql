-- 016_merge_guest_rpc.sql
-- Bind a companion added by name (015) to the account they later joined with:
-- fork groups naming the guest key name the member instead, the member keeps
-- the name the trip already calls them by, and the guest row goes. One
-- function, so a failure halfway leaves nothing half-merged.
--
-- Any member may bind, the same as adding or removing a guest (015).

create or replace function public.merge_guest_rpc(p_trip_id uuid, p_guest text, p_member text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.is_trip_member(p_trip_id) then
    return false;
  end if;

  select display_name into v_name
  from trip_members
  where trip_id = p_trip_id and user_email = p_guest and p_guest like 'guest:%';
  if not found then
    return false;
  end if;

  -- The account side must be a real member of this trip, never another guest
  if p_member like 'guest:%' or not exists (
    select 1 from trip_members where trip_id = p_trip_id and user_email = p_member
  ) then
    return false;
  end if;

  -- In each fork event naming the guest, the member takes the guest's place;
  -- where a group of that event already names the member, the guest key just
  -- goes, so nobody ends up in two groups at once.
  update events e
  set fork_items = (
    select jsonb_agg(
      case when i.item->'emails' ? p_guest then
        jsonb_set(i.item, '{emails}', coalesce((
          select jsonb_agg(case when t.el = p_guest then p_member else t.el end order by t.ord)
          from jsonb_array_elements_text(i.item->'emails') with ordinality as t(el, ord)
          where not (t.el = p_guest and a.already)
        ), '[]'::jsonb))
      else i.item end
      order by i.ord)
    from jsonb_array_elements(e.fork_items) with ordinality as i(item, ord),
      lateral (
        select exists (
          select 1 from jsonb_array_elements(e.fork_items) g where g->'emails' ? p_member
        ) as already
      ) a
  )
  where e.trip_id = p_trip_id
    and e.type = 'fork'
    and exists (select 1 from jsonb_array_elements(e.fork_items) g where g->'emails' ? p_guest);

  update trip_members set display_name = v_name
  where trip_id = p_trip_id and user_email = p_member;

  delete from trip_members where trip_id = p_trip_id and user_email = p_guest;

  return true;
end;
$$;

revoke execute on function public.merge_guest_rpc(uuid, text, text) from public, anon;
grant execute on function public.merge_guest_rpc(uuid, text, text) to authenticated;
