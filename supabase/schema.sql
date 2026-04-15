-- ============================================================
-- Content Agents — Supabase schema (FULL RESET + RECREATE)
-- ------------------------------------------------------------
-- Run this entire file in the Supabase SQL editor.
-- WARNING: This DROPS all existing app tables and their data.
--          Auth users in `auth.users` are preserved.
-- All tables use Row Level Security so users only see their own rows.
-- ============================================================


-- ============================================================
-- 1) TEAR DOWN — drop old trigger, function, and all app tables
-- ============================================================

drop trigger  if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- CASCADE removes dependent policies and indexes
drop table if exists public.creator_tools  cascade;
drop table if exists public.generations    cascade;
drop table if exists public.research_runs  cascade;
drop table if exists public.voice_samples  cascade;
drop table if exists public.competitors    cascade;
drop table if exists public.profiles       cascade;


-- ============================================================
-- 2) RECREATE TABLES
-- ============================================================

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  creator_name text,
  niche text,
  platforms text[] default '{}',
  tone text,
  goals text,
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create a profile row on new signups
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------- competitors ----------
create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube','instagram','facebook')),
  handle text not null,
  url text,
  notes text,
  created_at timestamptz default now()
);
create index competitors_user_idx on public.competitors(user_id);


-- ---------- voice_samples ----------
create table public.voice_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  content text not null,
  created_at timestamptz default now()
);
create index voice_samples_user_idx on public.voice_samples(user_id);


-- ---------- research_runs (YouTube/IG/FB viral research snapshots) ----------
create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  query text not null,
  results jsonb not null,
  created_at timestamptz default now()
);
create index research_runs_user_idx on public.research_runs(user_id, created_at desc);


-- ---------- generations (Generate page output: script + hooks) ----------
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  script jsonb,
  hooks jsonb,
  source_platform text,
  created_at timestamptz default now()
);
create index generations_user_idx on public.generations(user_id, created_at desc);


-- ---------- creator_tools (Shorts scripts · Social pack · Video metadata) ----------
create table public.creator_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('shorts','social','metadata')),
  source jsonb,            -- { videoId, title, url }
  payload jsonb not null,  -- Groq-generated JSON output
  created_at timestamptz default now()
);
create index creator_tools_user_idx on public.creator_tools(user_id, created_at desc);


-- ============================================================
-- 3) ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles       enable row level security;
alter table public.competitors    enable row level security;
alter table public.voice_samples  enable row level security;
alter table public.research_runs  enable row level security;
alter table public.generations    enable row level security;
alter table public.creator_tools  enable row level security;

-- profiles: user owns their own row (keyed by id, not user_id)
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

-- All other tables: generic "own rows" policies keyed by user_id
do $$
declare t text;
begin
  for t in select unnest(array[
    'competitors',
    'voice_samples',
    'research_runs',
    'generations',
    'creator_tools'
  ]) loop
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id);', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id);', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;


-- ============================================================
-- 4) BACKFILL profile rows for any existing auth users
--    (the trigger only fires on NEW signups, so existing users
--     need a profile row seeded manually after a reset)
-- ============================================================

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;


-- ============================================================
-- DONE. Expected tables:
--   profiles, competitors, voice_samples,
--   research_runs, generations, creator_tools
-- ============================================================
