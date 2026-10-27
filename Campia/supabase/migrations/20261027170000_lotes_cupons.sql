-- Lotes de preço (valor por data) e cupons de desconto na inscrição.
alter table public.championships add column if not exists price_tiers jsonb not null default '[]';

create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  code             text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  percent          integer check (percent between 1 and 100),
  amount_cents     integer check (amount_cents > 0),
  max_uses         integer check (max_uses > 0),
  created_at       timestamptz not null default now(),
  unique (championship_id, code),
  check ((percent is null) <> (amount_cents is null))
);
alter table public.coupons enable row level security;
-- Só o dono vê e gerencia; a validação na inscrição é feita pelo servidor.
drop policy if exists "cupons: dono gerencia" on public.coupons;
create policy "cupons: dono gerencia" on public.coupons
  for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));

alter table public.payments add column if not exists coupon_code text;
alter table public.payments add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0);
