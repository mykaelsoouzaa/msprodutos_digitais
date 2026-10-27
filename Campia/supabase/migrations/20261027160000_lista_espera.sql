-- Lista de espera: quando o campeonato lota, o time entra na fila e é avisado por e-mail se abrir vaga.
create table if not exists public.waitlist (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  team_name        text not null check (char_length(team_name) between 2 and 40),
  captain_name     text not null default '' check (char_length(captain_name) <= 60),
  email            text not null check (email = lower(email) and char_length(email) between 3 and 120),
  phone            text not null default '' check (phone ~ '^[0-9]{0,11}$'),
  created_at       timestamptz not null default now(),
  notified_at      timestamptz,
  unique (championship_id, email)
);
create index if not exists waitlist_championship_idx on public.waitlist (championship_id, created_at);

alter table public.waitlist enable row level security;
-- Entrar na fila é feito pelo servidor (service role); o dono vê e remove.
drop policy if exists "espera: dono lê" on public.waitlist;
drop policy if exists "espera: dono remove" on public.waitlist;
create policy "espera: dono lê" on public.waitlist for select using (public.is_owner(championship_id));
create policy "espera: dono remove" on public.waitlist for delete using (public.is_owner(championship_id));
