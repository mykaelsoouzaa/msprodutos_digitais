-- Patrocinadores do campeonato: aparecem na página pública, na impressão e nas artes.
create table if not exists public.sponsors (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 60),
  url              text not null default '' check (url = '' or (url ~ '^https?://' and char_length(url) <= 200)),
  logo_url         text not null default '' check (char_length(logo_url) <= 400),
  tier             text not null default 'apoio' check (tier in ('master', 'apoio')),
  created_at       timestamptz not null default now()
);
create index if not exists sponsors_championship_idx on public.sponsors (championship_id, created_at);

alter table public.sponsors enable row level security;
drop policy if exists "patrocinio: leitura" on public.sponsors;
drop policy if exists "patrocinio: dono cria" on public.sponsors;
drop policy if exists "patrocinio: dono apaga" on public.sponsors;
create policy "patrocinio: leitura" on public.sponsors for select using (public.can_read(championship_id));
create policy "patrocinio: dono cria" on public.sponsors for insert with check (public.is_owner(championship_id));
create policy "patrocinio: dono apaga" on public.sponsors for delete using (public.is_owner(championship_id));
