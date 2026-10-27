-- Plano Pro: só o dono lê; ninguém se dá Pro sozinho; pro_owner respeita a data.
insert into auth.users values ('00000000-0000-0000-0000-00000000c701'), ('00000000-0000-0000-0000-00000000c702');
insert into public.plans (owner_id, status, paid_until) values ('00000000-0000-0000-0000-00000000c701', 'ativo', now() + interval '10 days'),
  ('00000000-0000-0000-0000-00000000c702', 'cancelado', now() - interval '1 day');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c702', false);
do $$ begin
  if (select count(*) from public.plans) <> 1 then raise exception 'viu o plano de outra pessoa'; end if;
  update public.plans set paid_until = now() + interval '1 year' where owner_id = '00000000-0000-0000-0000-00000000c702';
  begin
    insert into public.plans (owner_id, status, paid_until) values ('00000000-0000-0000-0000-00000000c702', 'ativo', now() + interval '1 year');
    raise exception 'se deu Pro sozinho';
  exception when insufficient_privilege or unique_violation then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  if not public.pro_owner('00000000-0000-0000-0000-00000000c701') then raise exception 'Pro ativo não reconhecido'; end if;
  if public.pro_owner('00000000-0000-0000-0000-00000000c702') then raise exception 'Pro vencido continua ativo (ou update passou)'; end if;
end $$;
reset role;
select 'TESTES DO PLANO PRO PASSARAM';
