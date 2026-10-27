-- Atleta avulso: público vê sem telefone; capitão do campeonato vê o WhatsApp.
insert into auth.users values ('00000000-0000-0000-0000-00000000b601'), ('00000000-0000-0000-0000-00000000b602'), ('00000000-0000-0000-0000-00000000b603'), ('00000000-0000-0000-0000-00000000b604');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule)
  values ('00000000-0000-0000-0000-00000000b6aa', '00000000-0000-0000-0000-00000000b601', 'teste-avulso', 'Teste Avulso', 'Futsal', 'pontos', '{}');
insert into public.teams (id, championship_id, slot, name) values ('00000000-0000-0000-0000-00000000b6b1', '00000000-0000-0000-0000-00000000b6aa', 1, 'A');
insert into public.team_contacts (team_id, championship_id, captain_phone, captain_email)
  values ('00000000-0000-0000-0000-00000000b6b1', '00000000-0000-0000-0000-00000000b6aa', '', 'capitao@x.com');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000b602', false);
select set_config('request.jwt.claim.email', 'atleta@x.com', false);
insert into public.free_agents (championship_id, user_id, name, position, phone) values ('00000000-0000-0000-0000-00000000b6aa', '00000000-0000-0000-0000-00000000b602', 'Zé Avulso', 'Goleiro', '19988887777');
do $$ begin
  begin
    insert into public.free_agents (championship_id, user_id, name, phone) values ('00000000-0000-0000-0000-00000000b6aa', '00000000-0000-0000-0000-00000000b603', 'Falso', '19988887777');
    raise exception 'inscreveu outra pessoa';
  exception when insufficient_privilege then null; end;
end $$;
-- usuário qualquer: vê só a lista pública
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000b604', false);
select set_config('request.jwt.claim.email', 'curioso@x.com', false);
do $$ begin
  if (select count(*) from public.free_agents) <> 0 then raise exception 'curioso viu telefone'; end if;
  if (select count(*) from public.free_agents_public('00000000-0000-0000-0000-00000000b6aa')) <> 1 then raise exception 'lista pública vazia'; end if;
end $$;
-- capitão: vê o telefone
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000b603', false);
select set_config('request.jwt.claim.email', 'capitao@x.com', false);
do $$ begin
  if (select phone from public.free_agents limit 1) <> '19988887777' then raise exception 'capitão não vê o WhatsApp'; end if;
end $$;
select set_config('request.jwt.claim.email', '', false);
reset role;
select 'TESTES DE ATLETA AVULSO PASSARAM';
