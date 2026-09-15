-- 019_fk_indexes.sql
-- Postgres indexes a primary key but not a foreign key, so every one of these
-- was a sequential scan. They are the app's hot paths: each realtime push
-- refetches a whole trip's days and events by trip_id, a day's cascade delete
-- looks its events up by day_id, and both the RLS membership check and the
-- storage policies filter trip_members by user_email.
--
-- ponytail: plain CREATE INDEX, not CONCURRENTLY — the tables are small enough
-- that the brief lock is invisible, and CONCURRENTLY cannot run in a
-- transaction. Revisit if a trip ever holds enough rows to notice.
--
-- trip_members needs no trip_id index: its primary key (trip_id, user_email)
-- already leads with that column.

create index if not exists days_trip_id_idx         on days (trip_id);
create index if not exists events_trip_id_idx       on events (trip_id);
create index if not exists events_day_id_idx        on events (day_id);
create index if not exists trip_members_user_email_idx on trip_members (user_email);
