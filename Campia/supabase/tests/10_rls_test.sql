-- Testes de permissão e das funções de inscrição. Falha com erro se algo estiver errado.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- Dono A cria campeonato e vagas
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into championships (id, owner_id, slug, name, sport, format, fee_cents, schedule)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'copa-teste', 'Copa Teste', 'Futsal', 'pontos', 5000, '{"start":"2026-10-31","times":["09:00"],"fields":["Q1"]}');
insert into teams (id, championship_id, slot, name) values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 'Vaga 1'),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 2, 'Vaga 2');
insert into games (id, championship_id, stage, seq, label, home_team_id, away_team_id) values
  ('33333333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'liga', 1, 'Rodada 1', '22222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002');

-- Dono B não altera nem apaga o campeonato de A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ declare n int; begin
  update games set home_score = 9 where id = '33333333-0000-0000-0000-000000000001';
  get diagnostics n = row_count; if n <> 0 then raise exception 'B alterou jogo de A'; end if;
  delete from championships where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count; if n <> 0 then raise exception 'B apagou campeonato de A'; end if;
end $$;
do $$ begin
  begin
    insert into teams (id, championship_id, slot, name) values ('22222222-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 9, 'Intruso');
    raise exception 'B criou time no campeonato de A';
  exception when insufficient_privilege then null; end;
end $$;

-- Visitante (anon) lê o campeonato com link, mas não escreve nem chama as funções de inscrição
reset role; set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from championships) <> 1 then raise exception 'anon não leu campeonato'; end if;
  if (select count(*) from games) <> 1 then raise exception 'anon não leu jogos'; end if;
  if (select count(*) from team_contacts) <> 0 then raise exception 'anon leu telefones'; end if;
  if (select count(*) from payments) <> 0 then raise exception 'anon leu pagamentos'; end if;
end $$;
do $$ begin
  begin perform reserve_slot('11111111-1111-1111-1111-111111111111', 'X', 'X', 'X', '1', 30); raise exception 'anon reservou vaga';
  exception when insufficient_privilege then null; end;
end $$;

-- Servidor (service role): reserva as duas vagas, a terceira não existe
reset role; set role service_role;
do $$ declare t1 uuid; t2 uuid; t3 uuid; p uuid; begin
  t1 := reserve_slot('11111111-1111-1111-1111-111111111111', 'Resenha FC', 'RES', 'Mykael', '11999998888', 30);
  t2 := reserve_slot('11111111-1111-1111-1111-111111111111', 'Fúria FC', 'FUR', 'Diego', '11988887777', 30);
  t3 := reserve_slot('11111111-1111-1111-1111-111111111111', 'Atrasados', 'ATR', 'Zé', '11977776666', 30);
  if t1 is null or t2 is null or t1 = t2 then raise exception 'reserva falhou'; end if;
  if t3 is not null then raise exception 'reservou vaga além do limite'; end if;

  insert into payments (championship_id, team_id, amount_cents, provider) values ('11111111-1111-1111-1111-111111111111', t1, 5000, 'mock') returning id into p;
  if not confirm_payment(p) then raise exception 'confirmação falhou'; end if;
  if not confirm_payment(p) then raise exception 'confirmação não é idempotente'; end if;
  if (select status from teams where id = t1) <> 'inscrita' then raise exception 'time não ficou inscrito'; end if;

  -- reserva vencida volta a ficar disponível
  update teams set reserved_until = now() - interval '1 minute' where id = t2;
  t3 := reserve_slot('11111111-1111-1111-1111-111111111111', 'Atrasados', 'ATR', 'Zé', '11977776666', 30);
  if t3 <> t2 then raise exception 'reserva vencida não foi reaproveitada'; end if;
  if (select captain_phone from team_contacts where team_id = t3) <> '11977776666' then raise exception 'contato não atualizado'; end if;

  -- PIX antigo de uma reserva vencida que cai depois: não toma a vaga do novo time
  if (select count(*) from payments where team_id = t2 and status = 'expirado') <> 0 then raise exception 'sem pagamento pendente esperado'; end if;
  insert into payments (championship_id, team_id, amount_cents, provider, status) values ('11111111-1111-1111-1111-111111111111', t2, 5000, 'mock', 'expirado') returning id into p;
  if confirm_payment(p) then raise exception 'pagamento tardio confirmou vaga'; end if;
  if (select status from payments where id = p) <> 'pago_tarde' then raise exception 'status tardio errado'; end if;
  if (select status from teams where id = t2) <> 'reservada' then raise exception 'vaga do novo time foi alterada'; end if;
end $$;

-- Dono A vê telefones e pagamentos do próprio campeonato
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  if (select count(*) from team_contacts) <> 2 then raise exception 'dono não vê contatos'; end if;
  if (select count(*) from payments) <> 2 then raise exception 'dono não vê pagamentos'; end if;
end $$;
select 'TODOS OS TESTES DE BANCO PASSARAM' as resultado;

-- Notificações: visitante e dono não leem assinaturas; o servidor sim
reset role; set role service_role;
insert into push_subscriptions (championship_id, endpoint, p256dh, auth) values ('11111111-1111-1111-1111-111111111111', 'https://push.example/1', 'k', 'a');
do $$ begin
  begin
    insert into push_subscriptions (championship_id, endpoint, p256dh, auth) values ('11111111-1111-1111-1111-111111111111', 'https://push.example/1', 'k', 'a');
    raise exception 'assinatura duplicada aceita';
  exception when unique_violation then null; end;
end $$;
reset role; set role anon;
do $$ begin if (select count(*) from push_subscriptions) <> 0 then raise exception 'anon leu assinaturas'; end if; end $$;
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin if (select count(*) from push_subscriptions) <> 0 then raise exception 'dono leu assinaturas'; end if; end $$;
reset role;
select 'TESTES DE NOTIFICAÇÃO PASSARAM' as resultado;
