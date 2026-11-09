-- Entrada pelo portal: a lista de acessos usados é só do servidor.
set role anon;
do $$ begin
  if (select count(*) from public.portal_acessos_usados) <> 0 then raise exception 'anônimo leu os acessos'; end if;
  begin
    insert into public.portal_acessos_usados (jti, expira_em) values ('abcdefgh-teste', now());
    raise exception 'anônimo gravou acesso';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin
    insert into public.portal_acessos_usados (jti, expira_em) values ('abcdefgh-teste', now());
    raise exception 'usuário gravou acesso';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.portal_acessos_usados (jti, expira_em) values ('abcdefgh-teste', now());
do $$ begin
  begin
    insert into public.portal_acessos_usados (jti, expira_em) values ('abcdefgh-teste', now());
    raise exception 'acesso repetido foi aceito';
  exception when unique_violation then null; end;
end $$;
select 'TESTES DO PORTAL PASSARAM';
