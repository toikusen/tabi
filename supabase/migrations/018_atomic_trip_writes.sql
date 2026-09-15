-- 018_atomic_trip_writes.sql
-- Creating a trip and changing its dates were both multi-statement sequences
-- run from the browser, so a failure or a concurrent edit halfway through left
-- the trip broken. One function each, so each is one transaction.
--
-- Both are security invoker: the existing RLS policies (001, 004, 005, 008)
-- stay in force, the same as reorder_events_rpc (011).

-- Create trip: three inserts (trip, owner membership, days) that only make
-- sense together. Previously, a failed trip_members insert left a trip its
-- own creator could not read (trips_read needs the membership row), and a
-- failed days insert left a trip with no days at all.
--
-- owner_email and the membership row come from get_auth_email() rather than
-- the caller's arguments: the creator is whoever is calling.
create or replace function public.create_trip_rpc(
  p_name         text,
  p_start        date,
  p_end          date,
  p_display_name text,
  p_avatar_url   text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email   text := public.get_auth_email();
  v_trip_id uuid := gen_random_uuid();
begin
  if v_email is null or p_name is null or btrim(p_name) = ''
     or p_start is null or p_end is null or p_start > p_end then
    return null;
  end if;

  insert into trips (id, name, start_date, end_date, owner_email)
  values (v_trip_id, btrim(p_name), p_start, p_end, v_email);

  insert into trip_members (trip_id, user_email, display_name, avatar_url)
  values (v_trip_id, v_email, coalesce(p_display_name, ''), coalesce(p_avatar_url, ''));

  -- sort_order is the day's offset from the start, the same numbering the
  -- client used and the same one update_trip_dates_rpc renumbers to.
  insert into days (trip_id, date, label, sort_order)
  select v_trip_id, g::date, '', (g::date - p_start)
  from generate_series(p_start, p_end, interval '1 day') g;

  return v_trip_id;
end;
$$;

-- Change trip dates: drop the days that fell out of the range, add the ones
-- that came in, renumber, and move the trip's own dates.
--
-- The check for events on a day about to go used to run in its own request:
-- a tripmate adding an event to that day in the gap before the delete lost it
-- to the day's cascade. Here the check and the delete share a transaction, and
-- the FOR UPDATE below holds the days against that insert — an event's FK
-- takes a FOR KEY SHARE lock on its day, which FOR UPDATE conflicts with.
--
-- Returns { ok: true } | { ok: false, blocked: [date] } | { ok: false, error }.
create or replace function public.update_trip_dates_rpc(
  p_trip_id uuid,
  p_start   date,
  p_end     date
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_blocked text[];
begin
  if p_start is null or p_end is null or p_start > p_end then
    return jsonb_build_object('ok', false, 'error', 'INVALID_RANGE');
  end if;

  perform 1 from days where trip_id = p_trip_id for update;

  select coalesce(array_agg(d.date::text order by d.date), '{}')
    into v_blocked
  from days d
  where d.trip_id = p_trip_id
    and d.date not between p_start and p_end
    and exists (select 1 from events e where e.day_id = d.id);

  if coalesce(array_length(v_blocked, 1), 0) > 0 then
    return jsonb_build_object('ok', false, 'blocked', to_jsonb(v_blocked));
  end if;

  delete from days d
  where d.trip_id = p_trip_id
    and d.date not between p_start and p_end;

  insert into days (trip_id, date, label, sort_order)
  select p_trip_id, g::date, '', (g::date - p_start)
  from generate_series(p_start, p_end, interval '1 day') g
  where not exists (
    select 1 from days d where d.trip_id = p_trip_id and d.date = g::date
  );

  update days d
  set sort_order = (d.date - p_start)
  where d.trip_id = p_trip_id
    and d.sort_order is distinct from (d.date - p_start);

  update trips set start_date = p_start, end_date = p_end
  where id = p_trip_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.create_trip_rpc(text, date, date, text, text) from public, anon;
grant  execute on function public.create_trip_rpc(text, date, date, text, text) to authenticated;

revoke execute on function public.update_trip_dates_rpc(uuid, date, date) from public, anon;
grant  execute on function public.update_trip_dates_rpc(uuid, date, date) to authenticated;
