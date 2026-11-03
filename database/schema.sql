-- =========================================================
-- DEAR, 1995 — Supabase database setup
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- It is safe to run more than once.
-- =========================================================
--
-- Security model (no logins anywhere):
--   * The browser can NOT write to any table or storage bucket.
--   * Only the Edge Function "publish-letter" (running on Supabase's servers
--     with the secret service-role key) can create letters and upload files.
--   * The browser can read ONE published letter at a time, and only when it
--     already knows the letter's long random ID (via get_letter()).
--     Nobody can list or browse all letters.
--   * Drafts are never sent to the server — they stay on the creator's device.
-- =========================================================

-- 1) LETTERS ------------------------------------------------
create table if not exists public.letters (
  id            text primary key check (id ~ '^[A-Za-z0-9]{12,32}$'),
  content       jsonb        not null,               -- the letter (text, style, photo/music URLs, surprises)
  theme         text         not null default 'dear1995',
  is_published  boolean      not null default true,  -- set to false to take a letter offline
  created_at    timestamptz  not null default now()
);

comment on table public.letters is 'Published DEAR, 1995 letters. Written only by the publish-letter Edge Function.';

-- Turn on Row Level Security and add NO policies for anon/authenticated.
-- Result: the public API keys cannot select, insert, update or delete rows directly.
alter table public.letters enable row level security;
revoke all on table public.letters from anon, authenticated;

-- 2) RATE LIMIT LOG ----------------------------------------
create table if not exists public.publish_log (
  id          bigint generated always as identity primary key,
  ip_hash     text        not null,   -- SHA-256 of the IP + secret salt (the real IP is never stored)
  letter_id   text,
  created_at  timestamptz not null default now()
);
create index if not exists publish_log_ip_time on public.publish_log (ip_hash, created_at desc);
alter table public.publish_log enable row level security;
revoke all on table public.publish_log from anon, authenticated;

-- 3) SAFE READ FUNCTION ------------------------------------
-- Returns the content of ONE published letter, or NULL.
create or replace function public.get_letter(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select l.content
  from public.letters l
  where l.id = p_id
    and l.is_published = true
    and p_id ~ '^[A-Za-z0-9]{12,32}$'
  limit 1;
$$;

revoke all on function public.get_letter(text) from public;
grant execute on function public.get_letter(text) to anon, authenticated;

-- 4) STORAGE BUCKET FOR PHOTOS + MUSIC ---------------------
-- Public bucket = files can be viewed by their exact URL (needed so the
-- recipient's phone can show photos and play music).
-- There are NO insert/update/delete policies, so browsers cannot upload.
-- Uploads happen only inside the Edge Function with the service-role key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'letter-media',
  'letter-media',
  true,
  15728640, -- 15 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5) OPTIONAL HOUSEKEEPING ---------------------------------
-- Delete rate-limit entries older than 2 days (run occasionally, or schedule with pg_cron).
create or replace function public.cleanup_publish_log()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.publish_log where created_at < now() - interval '2 days';
$$;
revoke all on function public.cleanup_publish_log() from public, anon, authenticated;

-- To take a letter offline later:
--   update public.letters set is_published = false where id = 'THE_LETTER_ID';
