-- Ajudantes: o organizador convida pessoas por e-mail para lançar resultados e ajustar horários.
-- Ajudante não vê pagamentos, contatos nem ajustes, e não apaga o campeonato.

create table public.championship_helpers (
  championship_id  uuid not null references public.championships (id) on delete cascade,
  email            text not null check (email = lower(email) and char_length(email) between 3 and 120),
  created_at       timestamptz not null default now(),
  primary key (championship_id, email)
);
create index championship_helpers_email_idx on public.championship_helpers (email);

create or replace function public.is_helper(champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.championship_helpers h
    where h.championship_id = champ and h.email = lower(coalesce(auth.email(), ''))
  );
$$;

alter table public.championship_helpers enable row level security;
create policy "ajudantes: dono gerencia" on public.championship_helpers
  for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));
create policy "ajudantes: ajudante vê o próprio convite" on public.championship_helpers
  for select using (email = lower(coalesce(auth.email(), '')));

-- Jogos: ajudante altera placar, data, horário e campo (não cria nem apaga jogos).
create policy "jogos: ajudante lança" on public.games
  for update using (public.is_helper(championship_id)) with check (public.is_helper(championship_id));
-- Gols: ajudante grava e apaga os gols das partidas.
create policy "gols: ajudante escreve" on public.goals
  for all using (public.is_helper(championship_id)) with check (public.is_helper(championship_id));
