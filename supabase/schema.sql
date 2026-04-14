-- Content Agents — Supabase schema
-- Run this in the Supabase SQL editor after creating a new project.
-- All tables use Row Level Security so users can only see their own data.

-- ========== profiles ==========
create table if not exists public.profiles (
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

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========== competitors ==========
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube','instagram','facebook')),
  handle text not null,
  url text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists competitors_user_idx on public.competitors(user_id);

-- ========== voice_samples ==========
create table if not exists public.voice_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  content text not null,
  created_at timestamptz default now()
);
create index if not exists voice_samples_user_idx on public.voice_samples(user_id);

-- ========== research_runs ==========
create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  query text not null,
  results jsonb not null,
  created_at timestamptz default now()
);
create index if not exists research_runs_user_idx on public.research_runs(user_id, created_at desc);

-- ========== generations ==========
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  script jsonb,
  hooks jsonb,
  source_platform text,
  created_at timestamptz default now()
);
create index if not exists generations_user_idx on public.generations(user_id, created_at desc);

-- ========== RLS ==========
alter table public.profiles       enable row level security;
alter table public.competitors    enable row level security;
alter table public.voice_samples  enable row level security;
alter table public.research_runs  enable row level security;
alter table public.generations    enable row level security;

-- profiles: user can see/update own row
drop policy if exists "own profile read"  on public.profiles;
drop policy if exists "own profile write" on public.profiles;
create policy "own profile read"  on public.profiles for select using (auth.uid() = id);
create policy "own profile write" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

-- generic "own rows" for the other four tables
do $$
declare t text;
begin
  for t in select unnest(array['competitors','voice_samples','research_runs','generations']) loop
    execute format('drop policy if exists "own rows select" on public.%I;', t);
    execute format('drop policy if exists "own rows insert" on public.%I;', t);
    execute format('drop policy if exists "own rows update" on public.%I;', t);
    execute format('drop policy if exists "own rows delete" on public.%I;', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id);', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id);', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;
