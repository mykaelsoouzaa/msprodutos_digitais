-- Entrada pela área do cliente da MS Soluções: cada acesso assinado pelo portal vale uma vez só.
create table if not exists public.portal_acessos_usados (
  jti        text primary key check (char_length(jti) between 8 and 80),
  expira_em  timestamptz not null,
  usado_em   timestamptz not null default now()
);
alter table public.portal_acessos_usados enable row level security; -- sem políticas: só o servidor lê e grava
