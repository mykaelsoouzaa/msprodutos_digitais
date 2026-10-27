-- Admin: com 2FA confirmado mexe em qualquer campeonato; sem 2FA ou fora da lista, não.
insert into auth.users values ('00000000-0000-0000-0000-00000000e901'), ('00000000-0000-0000-0000-00000000e902');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule)
  values ('00000000-0000-0000-0000-00000000e9aa', '00000000-0000-0000-0000-00000000e901', 'teste-admin', 'Teste Admin', 'Futsal', 'pontos', '{}');
insert into public.platform_admins (email) values ('dono@campia.app.br');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000e902', false);
-- admin da lista, mas sem 2FA nesta sessão: não pode
select set_config('request.jwt.claim.email', 'dono@campia.app.br', false);
select set_config('request.jwt.claim.aal', 'aal1', false);
update public.championships set name = 'Sem 2FA' where id = '00000000-0000-0000-0000-00000000e9aa';
-- outro usuário com 2FA, fora da lista: não pode
select set_config('request.jwt.claim.email', 'curioso@x.com', false);
select set_config('request.jwt.claim.aal', 'aal2', false);
update public.championships set name = 'Intruso' where id = '00000000-0000-0000-0000-00000000e9aa';
reset role;
do $$ begin
  if (select name from public.championships where id = '00000000-0000-0000-0000-00000000e9aa') <> 'Teste Admin' then raise exception 'alterou sem ser admin com 2FA'; end if;
end $$;
-- admin com 2FA: altera e apaga
set role authenticated;
select set_config('request.jwt.claim.email', 'dono@campia.app.br', false);
select set_config('request.jwt.claim.aal', 'aal2', false);
update public.championships set name = 'Pelo admin' where id = '00000000-0000-0000-0000-00000000e9aa';
do $$ begin
  if (select name from public.championships where id = '00000000-0000-0000-0000-00000000e9aa') <> 'Pelo admin' then raise exception 'admin não conseguiu alterar'; end if;
  if (select count(*) from public.platform_admins) <> 0 then raise exception 'usuário leu a lista de admins'; end if;
end $$;
delete from public.championships where id = '00000000-0000-0000-0000-00000000e9aa';
reset role;
do $$ begin
  if exists (select 1 from public.championships where id = '00000000-0000-0000-0000-00000000e9aa') then raise exception 'admin não conseguiu apagar'; end if;
end $$;
select set_config('request.jwt.claim.email', '', false);
select set_config('request.jwt.claim.aal', '', false);
select 'TESTES DE ADMIN PASSARAM';
