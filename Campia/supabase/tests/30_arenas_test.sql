-- Página da arena: qualquer um lê, só o dono altera.
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2');
insert into public.arenas (owner_id, slug, name) values ('00000000-0000-0000-0000-0000000000a1', 'arena-central', 'Arena Central');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
do $$
declare n int;
begin
  select count(*) into n from public.arenas where slug = 'arena-central';
  if n <> 1 then raise exception 'arena deveria ser pública'; end if;
  update public.arenas set name = 'Invadida' where slug = 'arena-central';
  if (select name from public.arenas where slug = 'arena-central') <> 'Arena Central' then raise exception 'outro usuário alterou a arena'; end if;
  begin
    insert into public.arenas (owner_id, slug, name) values ('00000000-0000-0000-0000-0000000000a1', 'falsa', 'Falsa');
    raise exception 'criou arena em nome de outro';
  exception when insufficient_privilege then null; end;
  insert into public.arenas (owner_id, slug, name) values ('00000000-0000-0000-0000-0000000000a2', 'quadra-sul', 'Quadra Sul');
  begin
    insert into public.arenas (owner_id, slug, name) values ('00000000-0000-0000-0000-0000000000a2', 'segunda', 'Segunda');
    raise exception 'duas arenas para a mesma conta';
  exception when unique_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select 'TESTES DE ARENA PASSARAM';
