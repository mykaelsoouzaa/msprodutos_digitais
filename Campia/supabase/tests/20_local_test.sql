-- Testes do local do campeonato (roda depois das migrações).
do $$
declare uid uuid := gen_random_uuid(); cid uuid;
begin
  insert into auth.users (id) values (uid);
  insert into public.championships (owner_id, slug, name, sport, format, schedule, city)
    values (uid, 'teste-local', 'Teste Local', 'Futebol society', 'pontos', '{}', 'Campinas') returning id into cid;

  -- UF inválida é recusada
  begin
    update public.championships set state = 'Sao' where id = cid;
    raise exception 'UF inválida foi aceita';
  exception when check_violation then null; end;

  -- Online só vale para e-sports
  begin
    update public.championships set online = true where id = cid;
    raise exception 'futebol online foi aceito';
  exception when check_violation then null; end;
  update public.championships set sport = 'E-sports (EA FC)', online = true, city = '', state = '' where id = cid;

  delete from public.championships where id = cid;
  raise notice 'TESTES DE LOCAL PASSARAM';
end $$;
select 'TESTES DE LOCAL PASSARAM';
