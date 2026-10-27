-- Check-in: quais atletas estavam presentes em cada jogo (marcado pelo dono ou pelo ajudante).
create table if not exists public.checkins (
  game_id          uuid not null references public.games (id) on delete cascade,
  player_id        uuid not null references public.players (id) on delete cascade,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (game_id, player_id)
);
create index if not exists checkins_championship_idx on public.checkins (championship_id);

-- O atleta precisa ser de um dos dois times do jogo, no mesmo campeonato.
create or replace function public.player_in_game(p_game uuid, p_player uuid, p_champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.games g join public.players p on p.championship_id = g.championship_id
    where g.id = p_game and p.id = p_player and g.championship_id = p_champ
      and p.team_id in (g.home_team_id, g.away_team_id)
  );
$$;

alter table public.checkins enable row level security;
drop policy if exists "presenca: equipe lê" on public.checkins;
drop policy if exists "presenca: equipe marca" on public.checkins;
drop policy if exists "presenca: equipe desmarca" on public.checkins;
create policy "presenca: equipe lê" on public.checkins for select
  using (public.is_owner(championship_id) or public.is_helper(championship_id));
create policy "presenca: equipe marca" on public.checkins for insert
  with check ((public.is_owner(championship_id) or public.is_helper(championship_id)) and public.player_in_game(game_id, player_id, championship_id));
create policy "presenca: equipe desmarca" on public.checkins for delete
  using (public.is_owner(championship_id) or public.is_helper(championship_id));
