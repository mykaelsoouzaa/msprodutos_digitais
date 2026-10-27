-- Estatísticas de visitas: contagem por dia, página e origem. Só números, sem IP nem dado pessoal.
create table if not exists public.page_views (
  championship_id  uuid not null references public.championships (id) on delete cascade,
  day              date not null,
  page             text not null check (page in ('pagina', 'inscricao')),
  source           text not null check (source in ('whatsapp', 'instagram', 'facebook', 'google', 'busca', 'campia', 'direto', 'outros')),
  views            integer not null default 0 check (views >= 0),
  primary key (championship_id, day, page, source)
);

alter table public.page_views enable row level security;
-- Só o dono lê. Ninguém grava direto: a contagem passa pela função abaixo.
drop policy if exists "visitas: dono lê" on public.page_views;
create policy "visitas: dono lê" on public.page_views for select using (public.is_owner(championship_id));

-- Soma 1 visita. Qualquer visitante chama; valores fora da lista viram 'outros' / são ignorados.
create or replace function public.track_view(p_slug text, p_page text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
declare
  champ uuid;
  src text := case when p_source in ('whatsapp', 'instagram', 'facebook', 'google', 'busca', 'campia', 'direto') then p_source else 'outros' end;
begin
  if p_page not in ('pagina', 'inscricao') then return; end if;
  select id into champ from public.championships where slug = p_slug;
  if champ is null then return; end if;
  insert into public.page_views (championship_id, day, page, source, views)
    values (champ, (now() at time zone 'America/Sao_Paulo')::date, p_page, src, 1)
    on conflict (championship_id, day, page, source) do update set views = public.page_views.views + 1;
end $$;

revoke all on function public.track_view(text, text, text) from public;
grant execute on function public.track_view(text, text, text) to anon, authenticated;
