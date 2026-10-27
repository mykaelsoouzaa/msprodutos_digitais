-- Check-in: dono e ajudante marcam; atleta tem que ser de um dos times do jogo; público não vê.
insert into auth.users values ('00000000-0000-0000-0000-000000000c91'), ('00000000-0000-0000-0000-000000000c92');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule)
  values ('00000000-0000-0000-0000-000000000c9a', '00000000-0000-0000-0000-000000000c91', 'teste-checkin', 'Teste Checkin', 'Futsal', 'pontos', '{}');
insert into public.championship_helpers (championship_id, email) values ('00000000-0000-0000-0000-000000000c9a', 'mesario@x.com');
insert into public.teams (id, championship_id, slot, name) values
  ('00000000-0000-0000-0000-000000000ca1', '00000000-0000-0000-0000-000000000c9a', 1, 'A'),
  ('00000000-0000-0000-0000-000000000ca2', '00000000-0000-0000-0000-000000000c9a', 2, 'B'),
  ('00000000-0000-0000-0000-000000000ca3', '00000000-0000-0000-0000-000000000c9a', 3, 'C');
insert into public.players (id, championship_id, team_id, name) values
  ('00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000c9a', '00000000-0000-0000-0000-000000000ca1', 'Do A'),
  ('00000000-0000-0000-0000-000000000cb3', '00000000-0000-0000-0000-000000000c9a', '00000000-0000-0000-0000-000000000ca3', 'Do C');
insert into public.games (id, championship_id, stage, seq, label, home_team_id, away_team_id)
  values ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-000000000c9a', 'liga', 1, 'Rodada 1', '00000000-0000-0000-0000-000000000ca1', '00000000-0000-0000-0000-000000000ca2');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000c92', false);
select set_config('request.jwt.claim.email', 'mesario@x.com', false);
insert into public.checkins (game_id, player_id, championship_id) values ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-000000000cb1', '00000000-0000-0000-0000-000000000c9a');
do $$ begin
  begin
    insert into public.checkins (game_id, player_id, championship_id) values ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-000000000cb3', '00000000-0000-0000-0000-000000000c9a');
    raise exception 'marcou atleta de time que não joga essa partida';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.checkins) <> 1 then raise exception 'ajudante não vê a presença'; end if;
end $$;
select set_config('request.jwt.claim.email', '', false);
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.checkins) <> 0 then raise exception 'público viu a presença'; end if;
end $$;
reset role;
select 'TESTES DE CHECK-IN PASSARAM';
