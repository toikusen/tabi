-- 024_copy_trip_category.sql
-- copy_trip_rpc (020) lists the event columns one by one, so category (022)
-- was silently dropped on copy: "同樣的行程換一組日期" came back with every
-- icon re-guessed from the title, including the ones corrected by hand.
--
-- Unlike image_url, a category is a label with no reference out of the row, so
-- it copies as-is. Body otherwise identical to 020.

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
    location, notes, sort_order, fork_items, link_urls, category
  )
  select
    sd.new_id,               -- null for a wishlist event, which has no day
    v_new_id,
    e.type, e.title, e.time_start, e.time_end,
    e.location, e.notes, e.sort_order,
    public.remap_fork_emails(e.fork_items, v_guest_map),
    e.link_urls,
    e.category
  from events e
  left join src_days sd on sd.old_id = e.day_id
  where e.trip_id = p_trip_id;

  return v_new_id;
end;
$$;

revoke execute on function public.copy_trip_rpc(uuid, text, date) from public, anon;
grant  execute on function public.copy_trip_rpc(uuid, text, date) to authenticated;
