-- Lembretes por notificação (Web Push).
-- Cada aparelho inscrito segue um campeonato inteiro ou só um time.
-- Só o servidor (service role) lê e grava: as tabelas têm RLS ligado e nenhuma política.

create table public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  team_id          uuid references public.teams (id) on delete cascade,
  endpoint         text not null,
  p256dh           text not null,
  auth             text not null,
  leads            integer[] not null default '{1440,60}',
  created_at       timestamptz not null default now(),
  unique (endpoint, championship_id)
);
create index push_subscriptions_championship_idx on public.push_subscriptions (championship_id);

-- Garante que cada lembrete (inscrito × jogo × antecedência) sai uma vez só.
create table public.push_deliveries (
  subscription_id  uuid not null references public.push_subscriptions (id) on delete cascade,
  game_id          uuid not null references public.games (id) on delete cascade,
  lead             integer not null,
  sent_at          timestamptz not null default now(),
  primary key (subscription_id, game_id, lead)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_deliveries    enable row level security;
