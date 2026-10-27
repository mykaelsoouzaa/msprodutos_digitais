-- Lista de espera: só o dono do campeonato vê; ninguém insere direto pelo navegador.
insert into auth.users values ('00000000-0000-0000-0000-0000000000f7'), ('00000000-0000-0000-0000-0000000000f8');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule)
  values ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000f7', 'teste-espera', 'Teste Espera', 'Futsal', 'pontos', '{}');
insert into public.waitlist (championship_id, team_name, email) values ('00000000-0000-0000-0000-0000000000a7', 'Fila FC', 'fila@x.com');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f8', false);
do $$
begin
  if exists (select 1 from public.waitlist) then raise exception 'estranho vê a lista de espera'; end if;
  begin
    insert into public.waitlist (championship_id, team_name, email) values ('00000000-0000-0000-0000-0000000000a7', 'Furão', 'furao@x.com');
    raise exception 'inseriu direto na lista';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f7', false);
do $$
begin
  if (select count(*) from public.waitlist) <> 1 then raise exception 'dono não vê a lista'; end if;
  delete from public.waitlist where email = 'fila@x.com';
  if exists (select 1 from public.waitlist) then raise exception 'dono não removeu'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select 'TESTES DE LISTA DE ESPERA PASSARAM';
