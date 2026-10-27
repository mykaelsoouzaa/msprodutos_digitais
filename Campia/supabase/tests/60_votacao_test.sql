-- Votação: 1 voto por pessoa e categoria, só com a votação aberta, resultado escondido até encerrar.
insert into auth.users values ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2'), ('00000000-0000-0000-0000-0000000000c3');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule, voting)
  values ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000c1', 'teste-voto', 'Teste Voto', 'Futsal', 'pontos', '{}', 'fechada'),
         ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000c1', 'outro-voto', 'Outro', 'Futsal', 'pontos', '{}', 'aberta');
insert into public.teams (id, championship_id, slot, name) values
  ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000b9', 1, 'A'),
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000b8', 1, 'B');
insert into public.players (id, championship_id, team_id, name) values
  ('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000d9', 'Craque'),
  ('00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000d8', 'De outro campeonato');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
do $$
begin
  begin
    insert into public.votes (championship_id, category, player_id, voter_id) values ('00000000-0000-0000-0000-0000000000b9', 'craque', '00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000c2');
    raise exception 'votou com a votação fechada';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.championships set voting = 'aberta' where id = '00000000-0000-0000-0000-0000000000b9';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
insert into public.votes (championship_id, category, player_id, voter_id) values ('00000000-0000-0000-0000-0000000000b9', 'craque', '00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000c2');
do $$
begin
  begin
    insert into public.votes (championship_id, category, player_id, voter_id) values ('00000000-0000-0000-0000-0000000000b9', 'craque', '00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000c2');
    raise exception 'votou duas vezes na mesma categoria';
  exception when unique_violation then null; end;
  begin
    insert into public.votes (championship_id, category, player_id, voter_id) values ('00000000-0000-0000-0000-0000000000b9', 'goleiro', '00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000c3');
    raise exception 'votou em nome de outra pessoa';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.votes (championship_id, category, player_id, voter_id) values ('00000000-0000-0000-0000-0000000000b9', 'goleiro', '00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-0000000000c2');
    raise exception 'votou em atleta de outro campeonato';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.vote_results('00000000-0000-0000-0000-0000000000b9')) then raise exception 'resultado visível antes de encerrar'; end if;
end $$;
-- o dono vê o resultado parcial
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
do $$ begin
  if (select total from public.vote_results('00000000-0000-0000-0000-0000000000b9') where category = 'craque') <> 1 then raise exception 'dono não vê a parcial'; end if;
end $$;
reset role;
update public.championships set voting = 'encerrada' where id = '00000000-0000-0000-0000-0000000000b9';
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.vote_results('00000000-0000-0000-0000-0000000000b9')) <> 1 then raise exception 'resultado não ficou público ao encerrar'; end if;
end $$;
reset role;
select 'TESTES DE VOTAÇÃO PASSARAM';
