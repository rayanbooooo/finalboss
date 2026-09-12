-- Referral attribution.
--
-- The old referral link was generated client-side from Date.now() on every
-- page load, so it was different every time and tracked nothing. A code has to
-- be stable and owned by an account, which means it lives here.

alter table public.profiles
  add column if not exists referral_code text unique;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  -- One attribution per referred account, ever: unique, so a second attempt
  -- is a no-op rather than a duplicate.
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint referrals_no_self check (referrer_id <> referred_id)
);

alter table public.referrals enable row level security;

create policy "Referrers can see who they referred"
  on public.referrals for select
  using ((select auth.uid()) = referrer_id);

create policy "Referred users can see their own attribution"
  on public.referrals for select
  using ((select auth.uid()) = referred_id);

create index if not exists referrals_referrer_created_idx
  on public.referrals (referrer_id, created_at desc);

-- Resolving a code to its owner needs to read another user's profile row,
-- which RLS correctly forbids. A security-definer function is the narrow
-- exception: it takes a code and returns nothing about the owner, so it can't
-- be used to enumerate accounts beyond confirming a code exists.
create or replace function public.attribute_referral(code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_id uuid;
begin
  if auth.uid() is null or code is null or length(trim(code)) = 0 then
    return false;
  end if;

  select id into ref_id
  from public.profiles
  where referral_code = upper(trim(code))
  limit 1;

  -- Unknown code, or someone following their own link.
  if ref_id is null or ref_id = auth.uid() then
    return false;
  end if;

  insert into public.referrals (referrer_id, referred_id)
  values (ref_id, auth.uid())
  on conflict (referred_id) do nothing;

  return true;
end;
$$;

revoke all on function public.attribute_referral(text) from public;
grant execute on function public.attribute_referral(text) to authenticated;

-- `revoke ... from public` does not remove the grants Supabase issues to the
-- anon and authenticated roles directly.
revoke execute on function public.attribute_referral(text) from anon;
