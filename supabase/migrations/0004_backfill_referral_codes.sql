-- Backfill referral codes for profiles created before 0003 added the column.
--
-- loadProfile generates a code only when it inserts a profile row, so every
-- account that already existed when the referrals migration landed has a null
-- code and no referral link at all - the affiliates dashboard renders a dash
-- forever. contexts/OnboardingContext.tsx now writes a code when it reads a row
-- without one, which stops new orphans; this clears the existing ones.
--
-- Same alphabet as generateReferralCode in lib/referrals.ts: no 0/O/1/I,
-- because these get read off a screen and typed by hand.
do $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  target record;
  candidate text;
  attempts int;
begin
  for target in select id from public.profiles where referral_code is null loop
    attempts := 0;
    loop
      candidate := '';
      for _i in 1..8 loop
        candidate := candidate
          || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (
        select 1 from public.profiles where referral_code = candidate
      );
      attempts := attempts + 1;
      if attempts > 50 then
        raise exception 'Could not find an unused referral code after 50 attempts';
      end if;
    end loop;
    update public.profiles set referral_code = candidate where id = target.id;
  end loop;
end $$;
