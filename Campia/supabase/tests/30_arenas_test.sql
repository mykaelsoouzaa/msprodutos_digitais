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

-- Conta de repasse: só o dono lê e grava.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.payout_accounts (owner_id, asaas_wallet_id) values ('00000000-0000-0000-0000-0000000000a1', '0e1f2a3b-4c5d-6e7f-8091-a2b3c4d5e6f7');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
do $$
begin
  if exists (select 1 from public.payout_accounts) then raise exception 'outro usuário vê a conta de repasse'; end if;
  begin
    insert into public.payout_accounts (owner_id, asaas_wallet_id) values ('00000000-0000-0000-0000-0000000000a1', '0e1f2a3b-4c5d-6e7f-8091-a2b3c4d5e6f8')
      on conflict (owner_id) do update set asaas_wallet_id = excluded.asaas_wallet_id;
    raise exception 'outro usuário trocou a conta de repasse';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select 'TESTES DE REPASSE PASSARAM';
