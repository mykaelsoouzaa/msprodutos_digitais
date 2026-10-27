-- Indicação: só o servidor grava; quem indicou vê as próprias indicações; ninguém se indica.
insert into auth.users values ('00000000-0000-0000-0000-00000000d801'), ('00000000-0000-0000-0000-00000000d802'), ('00000000-0000-0000-0000-00000000d803');
insert into public.referral_codes (owner_id, code) values ('00000000-0000-0000-0000-00000000d801', 'abcd2345');
insert into public.referrals (referred_id, referrer_id) values ('00000000-0000-0000-0000-00000000d802', '00000000-0000-0000-0000-00000000d801');
do $$ begin
  begin
    insert into public.referrals (referred_id, referrer_id) values ('00000000-0000-0000-0000-00000000d803', '00000000-0000-0000-0000-00000000d803');
    raise exception 'indicou a si mesmo';
  exception when check_violation then null; end;
  begin
    insert into public.referral_codes (owner_id, code) values ('00000000-0000-0000-0000-00000000d803', 'ABC');
    raise exception 'aceitou código inválido';
  exception when check_violation then null; end;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000d801', false);
do $$ begin
  if (select count(*) from public.referrals) <> 1 then raise exception 'quem indicou não vê a indicação'; end if;
  if (select code from public.referral_codes) <> 'abcd2345' then raise exception 'dono não vê o código'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000d802', false);
do $$ begin
  if (select count(*) from public.referrals) <> 0 then raise exception 'indicado vê dados de quem indicou'; end if;
  begin
    insert into public.referrals (referred_id, referrer_id) values ('00000000-0000-0000-0000-00000000d803', '00000000-0000-0000-0000-00000000d802');
    raise exception 'usuário gravou indicação';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'TESTES DE INDICAÇÃO PASSARAM';
