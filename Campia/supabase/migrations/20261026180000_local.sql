-- Local do campeonato: estado (UF) separado da cidade e opção "online" (só para e-sports).

alter table public.championships
  add column state  text    not null default '' check (state = '' or state ~ '^[A-Z]{2}$'),
  add column online boolean not null default false;

alter table public.championships
  add constraint championships_online_esports check (not online or sport like 'E-sports%');

-- Campeonatos antigos guardavam "Cidade, UF" no campo cidade: separa os dois.
update public.championships c
   set city = trim(m[1]), state = upper(m[2])
  from (select id, regexp_match(city, '^\s*(.*?)\s*[,/-]\s*([A-Za-z]{2})\s*$') as m from public.championships) x
 where x.id = c.id and x.m is not null;
