-- Repasse automático: a cobrança PIX já sai dividida (split da Asaas) entre a Campia e a conta Asaas do organizador.

create table public.payout_accounts (
  owner_id         uuid primary key references auth.users (id) on delete cascade,
  asaas_wallet_id  text not null check (asaas_wallet_id ~ '^[0-9a-fA-F-]{36}$'),
  updated_at       timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
create policy "repasse: dono gerencia" on public.payout_accounts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Como o dinheiro de cada inscrição chega ao organizador.
alter table public.payments
  add column payout          text not null default 'manual' check (payout in ('automatico', 'manual')),
  add column split_wallet_id text,
  add column split_percent   numeric(7, 4) check (split_percent between 0 and 100);
