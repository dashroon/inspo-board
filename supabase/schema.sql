-- ============================================================
-- Inspo Board — standalone schema
-- Run this in the Supabase SQL editor.
-- Safe to run on an existing Calenrose project — all statements
-- are idempotent (IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

create table if not exists inspo_folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists inspo_sources (
  id              uuid primary key default gen_random_uuid(),
  url             text not null,
  name            text,
  position        integer not null default 0,
  last_crawled_at timestamptz,
  created_at      timestamptz default now()
);

create table if not exists inspo_photos (
  id           uuid primary key default gen_random_uuid(),
  source_id    uuid references inspo_sources(id) on delete set null,
  folder_id    uuid references inspo_folders(id) on delete set null,
  image_url    text not null,
  thumb_url    text,
  alt_text     text,
  page_url     text,
  photographer text,
  tags         text[] default '{}',
  favorited    boolean not null default false,
  hidden       boolean not null default false,
  position     integer not null default 0,
  added_at     timestamptz default now()
);

-- ── Columns that may be missing on an existing Calenrose install ──

-- hidden column (was added later in the Calenrose app)
alter table inspo_photos add column if not exists hidden boolean not null default false;

-- name column on sources (older schema used 'label')
alter table inspo_sources add column if not exists name text;

-- ── Indexes ──────────────────────────────────────────────────

create index if not exists inspo_photos_folder_id_idx  on inspo_photos(folder_id);
create index if not exists inspo_photos_source_id_idx  on inspo_photos(source_id);
create index if not exists inspo_photos_favorited_idx  on inspo_photos(favorited);
create index if not exists inspo_photos_hidden_idx     on inspo_photos(hidden);

-- ── Row Level Security ───────────────────────────────────────
-- This app has no authentication, so we grant the anon role
-- full access. If you previously ran the Calenrose schema you
-- may already have 'authenticated' policies — these new ones
-- add anon access on top of them.

alter table inspo_folders enable row level security;
alter table inspo_sources  enable row level security;
alter table inspo_photos   enable row level security;

-- Drop old anon policies if they exist so we can recreate cleanly
drop policy if exists "Anon read inspo_folders"   on inspo_folders;
drop policy if exists "Anon insert inspo_folders" on inspo_folders;
drop policy if exists "Anon update inspo_folders" on inspo_folders;
drop policy if exists "Anon delete inspo_folders" on inspo_folders;

drop policy if exists "Anon read inspo_sources"   on inspo_sources;
drop policy if exists "Anon insert inspo_sources" on inspo_sources;
drop policy if exists "Anon update inspo_sources" on inspo_sources;
drop policy if exists "Anon delete inspo_sources" on inspo_sources;

drop policy if exists "Anon read inspo_photos"   on inspo_photos;
drop policy if exists "Anon insert inspo_photos" on inspo_photos;
drop policy if exists "Anon update inspo_photos" on inspo_photos;
drop policy if exists "Anon delete inspo_photos" on inspo_photos;

-- inspo_folders
create policy "Anon read inspo_folders"   on inspo_folders for select to anon using (true);
create policy "Anon insert inspo_folders" on inspo_folders for insert to anon with check (true);
create policy "Anon update inspo_folders" on inspo_folders for update to anon using (true);
create policy "Anon delete inspo_folders" on inspo_folders for delete to anon using (true);

-- inspo_sources
create policy "Anon read inspo_sources"   on inspo_sources for select to anon using (true);
create policy "Anon insert inspo_sources" on inspo_sources for insert to anon with check (true);
create policy "Anon update inspo_sources" on inspo_sources for update to anon using (true);
create policy "Anon delete inspo_sources" on inspo_sources for delete to anon using (true);

-- inspo_photos
create policy "Anon read inspo_photos"   on inspo_photos for select to anon using (true);
create policy "Anon insert inspo_photos" on inspo_photos for insert to anon with check (true);
create policy "Anon update inspo_photos" on inspo_photos for update to anon using (true);
create policy "Anon delete inspo_photos" on inspo_photos for delete to anon using (true);

-- ── Realtime ─────────────────────────────────────────────────
-- Uncomment if you want live updates (optional for this app):
-- alter publication supabase_realtime add table inspo_folders;
-- alter publication supabase_realtime add table inspo_sources;
-- alter publication supabase_realtime add table inspo_photos;
