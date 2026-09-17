-- 023_trip_destination.sql
-- Where the trip goes, resolved once through Open-Meteo's geocoding search so
-- the timeline can show a forecast. Coordinates are stored rather than looked
-- up each time: the search matches on exact names ("那霸市" hits, "那霸" does
-- not), so resolving is a thing the traveller does once, by picking.

alter table trips add column if not exists destination text not null default '';
alter table trips add column if not exists lat double precision;
alter table trips add column if not exists lon double precision;

-- 008 revoked blanket UPDATE on trips and re-granted column by column.
grant update (destination, lat, lon) on table trips to authenticated;
