-- 020_copy_trip_rpc.sql
-- Copy a whole trip onto new dates: "same family, same shape, next year".
--
-- One function, so a copy that fails leaves nothing half-built — the same
-- reason create_trip_rpc exists (018). Security invoker, so the caller must
-- already be able to read the source under the existing RLS policies.
--
-- What comes across: days (labels kept, shifted to the new start), every
-- event including the wishlist ones, the fork groups, links, and the trip's
-- notes.
--
-- What does not:
--
--   * Members with accounts. Copying them would add people to a trip they
--     never agreed to join; they get invited as usual. Their emails stay in
--     the fork groups though, so the groups come back by themselves once
--     those people join.
--
--   * Images. image_url points into the SOURCE trip's storage folder, and
--     deleting that trip removes the folder (008) — a shared URL would take
--     the copy's pictures with it. An RPC cannot copy storage objects, so
--     the copies start without them.
--
-- Companions with no account ARE copied, with fresh keys. Their guest:<uuid>
-- is a row in one trip's trip_members, so carrying the old key over would
-- leave a group naming somebody who can never exist in the new trip —
-- permanently "未指定", and 長輩 are exactly who this feature is for.

-- Rewrites a fork_items array, swapping any email found in p_map for its
-- replacement and leaving the rest alone. Pure data shuffling; no trip
-- context, nothing to leak.
create or replace function public.remap_fork_emails(p_items jsonb, p_map jsonb)
returns jsonb
language sql
immutable
as $$
  select case when p_items is null then null else (
    select coalesce(
      jsonb_agg(
        case when i.item ? 'emails'
          then jsonb_set(i.item, '{emails}', (
            select coalesce(
              jsonb_agg(coalesce(p_map->>e.value, e.value) order by e.ord),
              '[]'::jsonb)
            from jsonb_array_elements_text(i.item->'emails') with ordinality as e(value, ord)
          ))
        else i.item end
        order by i.ord),
      '[]'::jsonb)
    from jsonb_array_elements(p_items) with ordinality as i(item, ord)
  ) end
$$;

create or replace function public.copy_trip_rpc(
  p_trip_id uuid,
  p_name    text,
  p_start   date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email     text := public.get_auth_email();
  v_new_id    uuid := gen_random_uuid();
  v_src_start date;
  v_src_end   date;
  v_notes     text;
  v_guest_map jsonb;
begin
  if v_email is null or p_name is null or btrim(p_name) = '' or p_start is null then
    return null;
  end if;

  select start_date, end_date, coalesce(notes, '')
  into v_src_start, v_src_end, v_notes
  from trips
  where id = p_trip_id;

  -- Not found, or RLS hid it because the caller is not a member
  if not found then
    return null;
  end if;

  insert into trips (id, name, start_date, end_date, owner_email, notes)
  values (v_new_id, btrim(p_name), p_start, p_start + (v_src_end - v_src_start), v_email, v_notes);

  insert into trip_members (trip_id, user_email, display_name, avatar_url)
  values (v_new_id, v_email, coalesce((select display_name from trip_members
                                       where trip_id = p_trip_id and user_email = v_email), ''),
                    coalesce((select avatar_url from trip_members
                              where trip_id = p_trip_id and user_email = v_email), ''));

  -- Companions with no account, each with a key of their own in the new trip
  with src_guests as (
    select user_email as old_key,
           display_name,
           'guest:' || gen_random_uuid() as new_key
    from trip_members
    where trip_id = p_trip_id and user_email like 'guest:%'
  ),
  moved as (
    insert into trip_members (trip_id, user_email, display_name, avatar_url)
    select v_new_id, new_key, display_name, '' from src_guests
    returning 1
  )
  select coalesce(jsonb_object_agg(old_key, new_key), '{}'::jsonb)
  into v_guest_map
  from src_guests;

  -- Days keep their titles and order, shifted onto the new start date. The
  -- new ids are picked here so the events below can be attached to them.
  with src_days as (
    select id as old_id, date, label, sort_order, gen_random_uuid() as new_id
    from days
    where trip_id = p_trip_id
  ),
  new_days as (
    insert into days (id, trip_id, date, label, sort_order)
    select new_id, v_new_id, p_start + (date - v_src_start), label, sort_order
    from src_days
    returning 1
  )
  insert into events (
    day_id, trip_id, type, title, time_start, time_end,
    location, notes, sort_order, fork_items, link_urls
  )
  select
    sd.new_id,               -- null for a wishlist event, which has no day
    v_new_id,
    e.type, e.title, e.time_start, e.time_end,
    e.location, e.notes, e.sort_order,
    public.remap_fork_emails(e.fork_items, v_guest_map),
    e.link_urls
  from events e
  left join src_days sd on sd.old_id = e.day_id
  where e.trip_id = p_trip_id;

  return v_new_id;
end;
$$;

revoke execute on function public.copy_trip_rpc(uuid, text, date) from public, anon;
grant  execute on function public.copy_trip_rpc(uuid, text, date) to authenticated;

-- Harmless on its own — jsonb in, jsonb out, no table touched — but a function
-- in the public schema defaults to EXECUTE for everyone, and anon has no
-- business calling it. copy_trip_rpc is security invoker, so its own calls run
-- as the caller and the grant below is what keeps them working.
revoke execute on function public.remap_fork_emails(jsonb, jsonb) from public, anon;
grant  execute on function public.remap_fork_emails(jsonb, jsonb) to authenticated;
