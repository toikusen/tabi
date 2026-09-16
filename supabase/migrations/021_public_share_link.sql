-- 021_public_share_link.sql
-- A read-only link for people with no account.
--
-- Until now there was NO unauthenticated read path at all: trip_preview_rpc
-- (009) is security definer but opens with `when auth.uid() is null then null`.
-- public_trip_rpc below is the first, and is deliberately the only one.
--
-- What it replaces: the plain-text itinerary pasted into LINE, which is a
-- snapshot — change the plan and the copy in someone's chat is silently stale.
-- The displayed range therefore matches itineraryText (src/lib/share.ts)
-- exactly: no wishlist, no images, no event links.

alter table trips add column if not exists share_token uuid unique;

-- 008 revoked UPDATE on trips and granted only (name, start_date, end_date),
-- so share_token cannot be written from a client at all — only through the
-- definer function below, which checks the owner itself.

-- A fork group's heading, resolved server-side so no email ever reaches the
-- public endpoint. Mirrors groupLabel() in src/lib/fork.ts: the members named
-- in the group, then 其他人 when it also takes everyone unnamed elsewhere,
-- falling back to an old free-text name and finally 未指定.
--
-- One difference, deliberate: names are ordered by user_email here, where the
-- app orders by the trip's member order. That order comes from a nested select
-- and is not actually guaranteed, so there is nothing stable to mirror; a
-- multi-person group may read 媽媽、爸爸 here and 爸爸、媽媽 in the app. Same
-- names, same rules, possibly different sequence.
create or replace function public.fork_group_labels(p_items jsonb, p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label', coalesce(nullif(g.label, ''), nullif(i.item->>'person', ''), '未指定'),
        'title', coalesce(i.item->>'title', ''),
        'location', coalesce(i.item->>'location', ''))
      order by i.ord),
    '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as i(item, ord)
  cross join lateral (
    select concat_ws('、',
      nullif((
        select string_agg(coalesce(nullif(m.display_name, ''), m.user_email), '、' order by m.user_email)
        from trip_members m
        where m.trip_id = p_trip_id
          and (
            -- A group saved with emails names them outright; one saved before
            -- groups had emails names a single person as free text instead.
            case when i.item ? 'emails'
              then i.item->'emails' ? m.user_email
              else coalesce(nullif(m.display_name, ''), m.user_email) = (i.item->>'person')
            end
          )
      ), ''),
      case when (i.item->>'others')::boolean then '其他人' end
    ) as label
  ) g
$$;

-- The itinerary behind a share token. No auth check: that is the point.
-- A null token returns null rather than matching every trip whose share_token
-- is null — the easiest way to get this function badly wrong.
create or replace function public.public_trip_rpc(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when p_token is null then null else (
    select jsonb_build_object(
      'name', t.name,
      'start_date', t.start_date,
      'end_date', t.end_date,
      'notes', coalesce(t.notes, ''),
      'days', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'date', d.date,
            'label', d.label,
            'events', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'type', e.type,
                  'title', e.title,
                  'time_start', e.time_start,
                  'time_end', e.time_end,
                  'location', e.location,
                  'notes', e.notes,
                  'groups', public.fork_group_labels(e.fork_items, t.id))
                order by e.sort_order)
              from events e
              where e.day_id = d.id), '[]'::jsonb))
          order by d.sort_order)
        from days d
        where d.trip_id = t.id), '[]'::jsonb))
    from trips t
    where t.share_token = p_token
  ) end
$$;

-- Owner-only. p_enabled true mints a fresh token — which is both "turn it on"
-- and "revoke the old link", since an old token stops matching the moment a
-- new one lands. false clears it.
create or replace function public.set_trip_share_rpc(p_trip_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.get_auth_email();
  v_token uuid;
begin
  if v_email is null
     or v_email is distinct from public.get_trip_owner_email(p_trip_id) then
    return jsonb_build_object('ok', false);
  end if;

  v_token := case when p_enabled then gen_random_uuid() else null end;
  update trips set share_token = v_token where id = p_trip_id;

  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

-- public_trip_rpc is the one function anon may call, and fork_group_labels
-- with it because it runs inside that call as the same role.
revoke execute on function public.public_trip_rpc(uuid) from public;
grant  execute on function public.public_trip_rpc(uuid) to anon, authenticated;

revoke execute on function public.fork_group_labels(jsonb, uuid) from public;
grant  execute on function public.fork_group_labels(jsonb, uuid) to anon, authenticated;

revoke execute on function public.set_trip_share_rpc(uuid, boolean) from public, anon;
grant  execute on function public.set_trip_share_rpc(uuid, boolean) to authenticated;
