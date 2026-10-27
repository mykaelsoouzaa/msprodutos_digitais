-- Perfil do atleta: pedido "Sou eu", aprovação pelo capitão, nada de aprovar o próprio pedido.
insert into auth.users values ('00000000-0000-0000-0000-00000000a501'), ('00000000-0000-0000-0000-00000000a502'), ('00000000-0000-0000-0000-00000000a503'), ('00000000-0000-0000-0000-00000000a504');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule)
  values ('00000000-0000-0000-0000-00000000a5aa', '00000000-0000-0000-0000-00000000a501', 'teste-atleta', 'Teste Atleta', 'Futsal', 'pontos', '{}');
insert into public.teams (id, championship_id, slot, name) values
  ('00000000-0000-0000-0000-00000000a5b1', '00000000-0000-0000-0000-00000000a5aa', 1, 'A'),
  ('00000000-0000-0000-0000-00000000a5b2', '00000000-0000-0000-0000-00000000a5aa', 2, 'B');
insert into public.team_contacts (team_id, championship_id, captain_phone, captain_email)
  values ('00000000-0000-0000-0000-00000000a5b1', '00000000-0000-0000-0000-00000000a5aa', '', 'capitao@x.com');
insert into public.players (id, championship_id, team_id, name) values
  ('00000000-0000-0000-0000-00000000a5c1', '00000000-0000-0000-0000-00000000a5aa', '00000000-0000-0000-0000-00000000a5b1', 'Rafinha'),
  ('00000000-0000-0000-0000-00000000a5c2', '00000000-0000-0000-0000-00000000a5aa', '00000000-0000-0000-0000-00000000a5b1', 'Capitão'),
  ('00000000-0000-0000-0000-00000000a5c3', '00000000-0000-0000-0000-00000000a5aa', '00000000-0000-0000-0000-00000000a5b2', 'Do B');

set role authenticated;
-- atleta comum (502) pede; não consegue se aprovar sozinho
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a502', false);
select set_config('request.jwt.claim.email', 'rafinha@x.com', false);
insert into public.athletes (user_id, handle, name) values ('00000000-0000-0000-0000-00000000a502', 'rafinha', 'Rafinha');
insert into public.player_claims (player_id, championship_id, team_id, user_id) values ('00000000-0000-0000-0000-00000000a5c1', '00000000-0000-0000-0000-00000000a5aa', '00000000-0000-0000-0000-00000000a5b1', '00000000-0000-0000-0000-00000000a502');
do $$ begin
  update public.player_claims set status = 'aprovado' where player_id = '00000000-0000-0000-0000-00000000a5c1';
  if (select status from public.player_claims where player_id = '00000000-0000-0000-0000-00000000a5c1') <> 'pendente' then raise exception 'atleta se aprovou sozinho'; end if;
  begin
    insert into public.player_claims (player_id, championship_id, team_id, user_id, status) values ('00000000-0000-0000-0000-00000000a5c3', '00000000-0000-0000-0000-00000000a5aa', '00000000-0000-0000-0000-00000000a5b2', '00000000-0000-0000-0000-00000000a502', 'aprovado');
    raise exception 'criou vínculo já aprovado';
  exception when insufficient_privilege or unique_violation then null; end;
  begin
    insert into public.player_claims (player_id, championship_id, team_id, user_id) values ('00000000-0000-0000-0000-00000000a5c3', '00000000-0000-0000-0000-00000000a5aa', '00000000-0000-0000-0000-00000000a5b1', '00000000-0000-0000-0000-00000000a503');
    raise exception 'pediu em nome de outra pessoa';
  exception when insufficient_privilege then null; end;
end $$;
-- capitão (503) aprova o pedido do time dele e se liga direto
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a503', false);
select set_config('request.jwt.claim.email', 'capitao@x.com', false);
update public.player_claims set status = 'aprovado' where player_id = '00000000-0000-0000-0000-00000000a5c1';
insert into public.player_claims (player_id, championship_id, team_id, user_id, status) values ('00000000-0000-0000-0000-00000000a5c2', '00000000-0000-0000-0000-00000000a5aa', '00000000-0000-0000-0000-00000000a5b1', '00000000-0000-0000-0000-00000000a503', 'aprovado');
do $$ begin
  if (select status from public.player_claims where player_id = '00000000-0000-0000-0000-00000000a5c1') <> 'aprovado' then raise exception 'capitão não aprovou'; end if;
end $$;
-- outro usuário (504) não vê pedidos pendentes de ninguém e não apaga vínculo dos outros
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a504', false);
select set_config('request.jwt.claim.email', 'outro@x.com', false);
delete from public.player_claims;
reset role;
do $$ begin
  if (select count(*) from public.player_claims where status = 'aprovado') <> 2 then raise exception 'outro usuário apagou vínculos'; end if;
end $$;
select set_config('request.jwt.claim.email', '', false);
select 'TESTES DE PERFIL DE ATLETA PASSARAM';
