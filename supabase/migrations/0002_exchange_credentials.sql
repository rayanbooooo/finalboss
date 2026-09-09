-- Exchange API credentials for the bring-your-own-key terminal.
--
-- The api_secret is NEVER stored here in a usable form. It is encrypted in the
-- browser under a passphrase only the user knows (PBKDF2-SHA256 -> AES-GCM),
-- and only the ciphertext, salt and IV are written to this table. Nothing on
-- the server, and nothing in this database, can decrypt it.
--
-- api_key is stored in the clear deliberately: it is an identifier rather than
-- a credential (useless without the secret), and the UI needs it to show which
-- key is connected before the user has unlocked anything.
--
-- Keys that carry withdrawal permission are refused at connect time and never
-- reach this table, so a compromise here cannot move funds off the exchange.

create table if not exists public.exchange_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  venue text not null check (venue in ('bybit')),
  is_testnet boolean not null default true,
  api_key text not null,
  -- Encrypted secret, base64. Meaningless without the user's passphrase.
  ciphertext text not null,
  salt text not null,
  iv text not null,
  iterations integer not null check (iterations >= 600000),
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- One key per venue per network: connecting again replaces rather than
  -- accumulating orphaned credentials the user can't see or revoke.
  unique (user_id, venue, is_testnet)
);

alter table public.exchange_credentials enable row level security;

create policy "Exchange credentials are viewable by their owner"
  on public.exchange_credentials for select
  using ((select auth.uid()) = user_id);

create policy "Exchange credentials are insertable by their owner"
  on public.exchange_credentials for insert
  with check ((select auth.uid()) = user_id);

create policy "Exchange credentials are updatable by their owner"
  on public.exchange_credentials for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Disconnecting a key has to actually delete it, so the owner needs this.
create policy "Exchange credentials are deletable by their owner"
  on public.exchange_credentials for delete
  using ((select auth.uid()) = user_id);
