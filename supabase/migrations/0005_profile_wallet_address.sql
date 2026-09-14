-- An optional wallet address on a profile.
--
-- A wallet is not an identity here: the account is the email, and nothing in
-- the app gates on this column. It exists so a linked address follows the
-- account to another browser instead of living only in wagmi's local storage.
--
-- Nullable with no backfill: almost nobody has one, and an absent wallet is
-- the normal case rather than missing data.
alter table public.profiles
  add column if not exists wallet_address text;

comment on column public.profiles.wallet_address is
  'Optional linked wallet. Display only - never used for authentication.';
