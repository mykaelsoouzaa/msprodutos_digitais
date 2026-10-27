-- Votação do craque do campeonato: 1 voto por pessoa (login) e categoria; resultado só sai quando o organizador encerra.
alter table public.championships add column if not exists voting text not null default 'fechada'
  check (voting in ('fechada', 'aberta', 'encerrada'));

create table if not exists public.votes (
  championship_id  uuid not null references public.championships (id) on delete cascade,
  category         text not null check (category in ('craque', 'goleiro', 'revelacao')),
  player_id        uuid not null references public.players (id) on delete cascade,
  voter_id         uuid not null references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (championship_id, category, voter_id)
);

create or replace function public.voting_open(champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.championships where id = champ and voting = 'aberta');
$$;
create or replace function public.player_in(champ uuid, player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players where id = player and championship_id = champ);
$$;

alter table public.votes enable row level security;
drop policy if exists "votos: vê o próprio" on public.votes;
drop policy if exists "votos: vota com a votação aberta" on public.votes;
drop policy if exists "votos: muda o próprio voto" on public.votes;
create policy "votos: vê o próprio" on public.votes for select using (voter_id = auth.uid());
create policy "votos: vota com a votação aberta" on public.votes for insert
  with check (voter_id = auth.uid() and public.voting_open(championship_id) and public.player_in(championship_id, player_id));
create policy "votos: muda o próprio voto" on public.votes for update
  using (voter_id = auth.uid() and public.voting_open(championship_id))
  with check (voter_id = auth.uid() and public.voting_open(championship_id) and public.player_in(championship_id, player_id));

-- Resultado (contagem por atleta): o dono vê a qualquer momento; o público, depois de encerrada.
create or replace function public.vote_results(champ uuid)
returns table (category text, player_id uuid, total bigint)
language sql stable security definer set search_path = public as $$
  select v.category, v.player_id, count(*) as total
    from public.votes v
   where v.championship_id = champ
     and (public.is_owner(champ) or exists (select 1 from public.championships c where c.id = champ and c.voting = 'encerrada'))
   group by v.category, v.player_id
   order by v.category, total desc;
$$;
revoke all on function public.vote_results(uuid) from public;
grant execute on function public.vote_results(uuid) to anon, authenticated, service_role;
