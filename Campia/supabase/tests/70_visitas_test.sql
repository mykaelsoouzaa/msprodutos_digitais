-- Visitas: qualquer um soma pela função; ninguém grava direto; só o dono lê.
insert into auth.users values ('00000000-0000-0000-0000-0000000000f1'), ('00000000-0000-0000-0000-0000000000f2');
insert into public.championships (id, owner_id, slug, name, sport, format, schedule)
  values ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000f1', 'teste-visita', 'Teste Visita', 'Futsal', 'pontos', '{}');

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.track_view('teste-visita', 'pagina', 'whatsapp');
select public.track_view('teste-visita', 'pagina', 'whatsapp');
select public.track_view('teste-visita', 'inscricao', 'qualquer-coisa');
select public.track_view('teste-visita', 'painel', 'google');
select public.track_view('nao-existe', 'pagina', 'google');
do $$
begin
  if (select count(*) from public.page_views) <> 0 then raise exception 'anônimo leu as visitas'; end if;
  begin
    insert into public.page_views values ('00000000-0000-0000-0000-0000000000fa', current_date, 'pagina', 'google', 1000);
    raise exception 'anônimo gravou visita direto';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
do $$ begin
  if (select count(*) from public.page_views) <> 0 then raise exception 'outro usuário leu as visitas'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
do $$ begin
  if (select views from public.page_views where page = 'pagina' and source = 'whatsapp') <> 2 then raise exception 'contagem errada'; end if;
  if (select source from public.page_views where page = 'inscricao') <> 'outros' then raise exception 'origem desconhecida não virou outros'; end if;
  if (select count(*) from public.page_views) <> 2 then raise exception 'gravou página inválida'; end if;
end $$;
reset role;
select 'TESTES DE VISITAS PASSARAM';
