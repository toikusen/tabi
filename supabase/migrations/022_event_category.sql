-- 022_event_category.sql
-- The leading icon was guessed from the title (src/lib/category.ts) with no way
-- to correct a wrong guess. A null category keeps the guess, so every existing
-- row behaves exactly as before.

alter table events add column if not exists category text;

-- events carries table-level grants (001), so a new column needs no grant of
-- its own — unlike trips, whose UPDATE is column-scoped since 008.
