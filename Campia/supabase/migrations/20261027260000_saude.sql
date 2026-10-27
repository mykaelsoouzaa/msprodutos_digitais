-- Saúde do sistema: registro de falhas (PIX, webhook, agendador, e-mail) e último sinal de vida de cada parte.
-- Só o servidor (service role) lê e grava: nenhuma política de acesso para usuários.
create table if not exists public.system_events (
  id          bigint generated always as identity primary key,
  kind        text not null check (char_length(kind) between 1 and 30),
  message     text not null default '' check (char_length(message) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists system_events_kind_idx on public.system_events (kind, created_at desc);
alter table public.system_events enable row level security;

create table if not exists public.system_status (
  key   text primary key check (char_length(key) <= 60),
  at    timestamptz not null default now(),
  info  text not null default '' check (char_length(info) <= 300)
);
alter table public.system_status enable row level security;
