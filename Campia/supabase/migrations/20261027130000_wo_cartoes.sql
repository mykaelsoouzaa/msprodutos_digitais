-- W.O. e cartões.

-- W.O.: qual time faltou. Com W.O., o placar guardado é o placar padrão do esporte.
alter table public.games
  add column wo text check (wo in ('home', 'away', 'both'));
alter table public.games
  add constraint games_wo_both_not_ko check (wo is distinct from 'both' or stage <> 'ko');

-- Cartões por atleta e partida. Dois amarelos no mesmo jogo contam como expulsão.
create table public.cards (
  game_id          uuid not null references public.games (id) on delete cascade,
  player_id        uuid not null references public.players (id) on delete cascade,
  team_id          uuid not null references public.teams (id) on delete cascade,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  yellow           integer not null default 0 check (yellow between 0 and 2),
  red              boolean not null default false,
  primary key (game_id, player_id),
  check (yellow > 0 or red)
);
create index cards_championship_idx on public.cards (championship_id);

alter table public.cards enable row level security;
create policy "cartões: leitura" on public.cards for select using (public.can_read(championship_id));
create policy "cartões: dono escreve" on public.cards for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));
create policy "cartões: ajudante escreve" on public.cards for all using (public.is_helper(championship_id)) with check (public.is_helper(championship_id));
