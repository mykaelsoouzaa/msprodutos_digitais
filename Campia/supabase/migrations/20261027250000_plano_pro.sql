-- Plano Pro dos organizadores (assinatura mensal pela Asaas ou cortesia dada pelo dono da Campia).
create table if not exists public.plans (
  owner_id               uuid primary key references auth.users (id) on delete cascade,
  status                 text not null default 'pendente' check (status in ('pendente', 'ativo', 'cancelado')),
  source                 text not null default 'asaas' check (source in ('asaas', 'cortesia')),
  paid_until             timestamptz,
  asaas_customer_id      text,
  asaas_subscription_id  text unique,
  invoice_url            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.plans enable row level security;
-- O organizador vê o próprio plano. Gravação só pelo servidor (service role).
drop policy if exists "plano: dono lê" on public.plans;
create policy "plano: dono lê" on public.plans for select using (owner_id = auth.uid());

-- Pro = pago (ou cortesia) até uma data no futuro. Usado pelas páginas públicas (sem marca, patrocinadores).
create or replace function public.pro_owner(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plans where owner_id = p_owner and paid_until > now());
$$;
grant execute on function public.pro_owner(uuid) to anon, authenticated;

-- Taxa da Campia gravada em cada inscrição (o Pro paga menos; muda se o plano mudar depois).
alter table public.payments add column if not exists fee_percent numeric(7, 4) check (fee_percent between 0 and 100);
