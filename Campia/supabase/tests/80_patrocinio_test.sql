-- Patrocinadores: público lê; só o dono cria e apaga.
insert into auth.users values ('00000000-0000-0000-0000-000000000a71'), ('00000000-0000-0000-0000-000000000a72');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule)
  values ('00000000-0000-0000-0000-000000000a7a', '00000000-0000-0000-0000-000000000a71', 'teste-patro', 'Teste Patro', 'Futsal', 'pontos', '{}');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a71', false);
insert into public.sponsors (championship_id, name, url, tier) values ('00000000-0000-0000-0000-000000000a7a', 'Padaria Pão Bom', 'https://paobom.com.br', 'master');
do $$ begin
  begin
    insert into public.sponsors (championship_id, name, url) values ('00000000-0000-0000-0000-000000000a7a', 'Link ruim', 'javascript:alert(1)');
    raise exception 'aceitou link javascript';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000a72', false);
do $$ begin
  begin
    insert into public.sponsors (championship_id, name) values ('00000000-0000-0000-0000-000000000a7a', 'Intruso');
    raise exception 'outro usuário criou patrocinador';
  exception when insufficient_privilege then null; end;
  delete from public.sponsors where championship_id = '00000000-0000-0000-0000-000000000a7a';
end $$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.sponsors where championship_id = '00000000-0000-0000-0000-000000000a7a') <> 1 then raise exception 'público não vê o patrocinador (ou o intruso apagou)'; end if;
end $$;
reset role;
select 'TESTES DE PATROCÍNIO PASSARAM';
