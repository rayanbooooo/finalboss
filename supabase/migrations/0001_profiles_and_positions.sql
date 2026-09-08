-- FinalBoss: account profiles and trading positions.
--
-- Both tables are per-user and RLS-isolated: a signed-in account can only
-- ever read or write its own rows. Applied against an existing project, so
-- this file only ever creates new objects - it drops nothing.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  method text not null check (method in ('wallet', 'email')),
  experience_level text not null check (experience_level in ('new', 'some', 'experienced')),
  risk_tolerance text not null check (risk_tolerance in ('conservative', 'moderate', 'aggressive')),
  default_leverage integer not null default 10 check (default_leverage between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Profiles are insertable by their owner"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "Profiles are updatable by their owner"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  market_id text not null,
  symbol text not null,
  side text not null check (side in ('long', 'short')),
  leverage integer not null check (leverage between 1 and 1000),
  margin numeric not null check (margin > 0),
  size numeric not null,
  entry_price numeric not null,
  liquidation_price numeric not null,
  status text not null default 'open' check (status in ('open', 'closed', 'liquidated')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  close_price numeric,
  realized_pnl numeric
);

alter table public.positions enable row level security;

create policy "Positions are viewable by their owner"
  on public.positions for select
  using ((select auth.uid()) = user_id);

create policy "Positions are insertable by their owner"
  on public.positions for insert
  with check ((select auth.uid()) = user_id);

create policy "Positions are updatable by their owner"
  on public.positions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Positions are deletable by their owner"
  on public.positions for delete
  using ((select auth.uid()) = user_id);

-- The terminal's two reads are "my open positions" and "my closed history",
-- both newest-first.
create index if not exists positions_user_status_opened_at_idx
  on public.positions (user_id, status, opened_at desc);
