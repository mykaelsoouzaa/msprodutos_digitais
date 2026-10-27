-- Indique uma arena: código de indicação de cada organizador e quem chegou por ele.
create table if not exists public.referral_codes (
  owner_id    uuid primary key references auth.users (id) on delete cascade,
  code        text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  created_at  timestamptz not null default now()
);
create table if not exists public.referrals (
  referred_id  uuid primary key references auth.users (id) on delete cascade,
  referrer_id  uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  rewarded_at  timestamptz,
  check (referred_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
-- O organizador vê o próprio código e as próprias indicações. Gravação só pelo servidor.
drop policy if exists "indicacao: dono lê código" on public.referral_codes;
drop policy if exists "indicacao: quem indicou lê" on public.referrals;
create policy "indicacao: dono lê código" on public.referral_codes for select using (owner_id = auth.uid());
create policy "indicacao: quem indicou lê" on public.referrals for select using (referrer_id = auth.uid());
