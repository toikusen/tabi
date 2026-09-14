-- 014_event_links.sql
-- An event can carry several links (official site, booking page, blog post).
--
-- link_url (007) is kept so installed PWAs still running the old bundle keep
-- working; the app no longer writes it. Drop it once those have updated.

alter table events add column if not exists link_urls text[] not null default '{}';

update events set link_urls = array[link_url]
where link_url is not null and link_url <> '' and link_urls = '{}';
