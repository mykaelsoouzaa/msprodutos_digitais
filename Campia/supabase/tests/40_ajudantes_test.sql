-- Ajudante lança resultado; não mexe em pagamentos, times ou no campeonato.
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2'), ('00000000-0000-0000-0000-0000000000d3');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule)
  values ('00000000-0000-0000-0000-00000000c0de', '00000000-0000-0000-0000-0000000000d1', 'teste-ajudante', 'Teste Ajudante', 'Futebol society', 'pontos', '{}');
insert into public.teams (id, championship_id, slot, name) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000c0de', 1, 'A'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000c0de', 2, 'B');
insert into public.games (id, championship_id, stage, seq, label, home_team_id, away_team_id)
  values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000c0de', 'liga', 1, 'Rodada 1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');
insert into public.players (id, championship_id, team_id, name) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000c0de', '00000000-0000-0000-0000-0000000000e1', 'Zé');

-- Dono convida
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
select set_config('request.jwt.claim.email', 'dono@x.com', false);
insert into public.championship_helpers (championship_id, email) values ('00000000-0000-0000-0000-00000000c0de', 'mesario@x.com');

-- Ajudante
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', false);
select set_config('request.jwt.claim.email', 'Mesario@X.com', false);
do $$
begin
  if (select count(*) from public.championship_helpers) <> 1 then raise exception 'ajudante não vê o próprio convite'; end if;
  update public.games set home_score = 2, away_score = 1 where id = '00000000-0000-0000-0000-0000000000f1';
  if (select home_score from public.games where id = '00000000-0000-0000-0000-0000000000f1') is distinct from 2 then raise exception 'ajudante não lançou o placar'; end if;
  insert into public.goals (game_id, player_id, team_id, championship_id, count)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000c0de', 2);
  update public.teams set name = 'Hackeado' where championship_id = '00000000-0000-0000-0000-00000000c0de';
  if exists (select 1 from public.teams where name = 'Hackeado') then raise exception 'ajudante alterou time'; end if;
  update public.championships set name = 'Hackeado' where id = '00000000-0000-0000-0000-00000000c0de';
  if exists (select 1 from public.championships where name = 'Hackeado') then raise exception 'ajudante alterou campeonato'; end if;
  begin
    insert into public.championship_helpers (championship_id, email) values ('00000000-0000-0000-0000-00000000c0de', 'amigo@x.com');
    raise exception 'ajudante convidou outro';
  exception when insufficient_privilege then null; end;
  delete from public.games where id = '00000000-0000-0000-0000-0000000000f1';
  if not exists (select 1 from public.games where id = '00000000-0000-0000-0000-0000000000f1') then raise exception 'ajudante apagou jogo'; end if;
end $$;

-- Estranho (logado, sem convite)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d3', false);
select set_config('request.jwt.claim.email', 'estranho@x.com', false);
do $$
begin
  update public.games set home_score = 9 where id = '00000000-0000-0000-0000-0000000000f1';
  if (select home_score from public.games where id = '00000000-0000-0000-0000-0000000000f1') = 9 then raise exception 'estranho lançou placar'; end if;
  if exists (select 1 from public.championship_helpers) then raise exception 'estranho vê convites'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.email', '', false);
select 'TESTES DE AJUDANTE PASSARAM';
