-- Masters Pool 2025 — Supabase Schema
-- Run this in the Supabase SQL editor

-- ─── Golfers ───────────────────────────────────────────────────────────────
create table if not exists public.golfers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  tier         int  not null check (tier between 1 and 6),
  espn_id      text,
  score        int  not null default 0,
  position     int,
  is_cut       boolean not null default false,
  holes_played int not null default 0,
  updated_at   timestamptz default now()
);

-- ─── Profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  username   text not null unique,
  is_admin   boolean not null default false,
  created_at timestamptz default now()
);

-- ─── Picks ─────────────────────────────────────────────────────────────────
create table if not exists public.picks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  golfer_id  uuid not null references public.golfers (id) on delete cascade,
  slot       int  not null check (slot between 1 and 6),
  created_at timestamptz default now(),
  unique (user_id, slot)
);

-- ─── Settings ──────────────────────────────────────────────────────────────
create table if not exists public.settings (
  id                uuid primary key default gen_random_uuid(),
  picks_deadline    timestamptz,
  tournament_active boolean not null default false,
  last_score_sync   timestamptz
);

-- Insert a default settings row
insert into public.settings (tournament_active)
values (false);
