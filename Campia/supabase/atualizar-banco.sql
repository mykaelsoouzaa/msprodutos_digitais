-- =============================================================================
-- Campia · atualizar o banco até a versão 2.5.0
--
-- Pode rodar quantas vezes quiser: cada parte só cria o que ainda não existe.
-- Use no Supabase › SQL Editor quando o banco já tem a primeira migração (init).
-- Para um banco novo, rode antes migrations/20261026000000_init.sql.
-- =============================================================================

-- 1.0 · Lembretes por notificação ----------------------------------------------
create table if not exists public.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  team_id          uuid references public.teams (id) on delete cascade,
  endpoint         text not null,
  p256dh           text not null,
  auth             text not null,
  leads            integer[] not null default '{1440,60}',
  created_at       timestamptz not null default now(),
  unique (endpoint, championship_id)
);
create index if not exists push_subscriptions_championship_idx on public.push_subscriptions (championship_id);
create table if not exists public.push_deliveries (
  subscription_id  uuid not null references public.push_subscriptions (id) on delete cascade,
  game_id          uuid not null references public.games (id) on delete cascade,
  lead             integer not null,
  sent_at          timestamptz not null default now(),
  primary key (subscription_id, game_id, lead)
);
alter table public.push_subscriptions enable row level security;
alter table public.push_deliveries    enable row level security;

-- 1.2 · Cidade, estado e online ------------------------------------------------
alter table public.championships
  add column if not exists state  text    not null default '' check (state = '' or state ~ '^[A-Z]{2}$'),
  add column if not exists online boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'championships_online_esports') then
    alter table public.championships add constraint championships_online_esports check (not online or sport like 'E-sports%');
  end if;
end $$;
-- Separa "Cidade, UF" gravado no campo cidade (só onde o estado ainda está vazio).
update public.championships c
   set city = trim(m[1]), state = upper(m[2])
  from (select id, regexp_match(city, '^\s*(.*?)\s*[,/-]\s*([A-Za-z]{2})\s*$') as m from public.championships where state = '') x
 where x.id = c.id and x.m is not null;

-- 1.3 · Explorar campeonatos ---------------------------------------------------
create index if not exists championships_public_place_idx
  on public.championships (state, city) where visibility = 'publico';

-- 1.4 · Página da arena --------------------------------------------------------
create table if not exists public.arenas (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references auth.users (id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name        text not null check (char_length(name) between 2 and 80),
  bio         text not null default '' check (char_length(bio) <= 400),
  address     text not null default '' check (char_length(address) <= 120),
  city        text not null default '' check (char_length(city) <= 60),
  state       text not null default '' check (state = '' or state ~ '^[A-Z]{2}$'),
  whatsapp    text not null default '' check (whatsapp ~ '^[0-9]{0,11}$'),
  instagram   text not null default '' check (instagram ~ '^[A-Za-z0-9._]{0,30}$'),
  logo_url    text not null default '',
  created_at  timestamptz not null default now()
);
alter table public.arenas enable row level security;
drop policy if exists "arena: leitura pública" on public.arenas;
drop policy if exists "arena: dono cria" on public.arenas;
drop policy if exists "arena: dono altera" on public.arenas;
drop policy if exists "arena: dono apaga" on public.arenas;
create policy "arena: leitura pública" on public.arenas for select using (true);
create policy "arena: dono cria" on public.arenas for insert with check (owner_id = auth.uid());
create policy "arena: dono altera" on public.arenas for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "arena: dono apaga" on public.arenas for delete using (owner_id = auth.uid());
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('arenas', 'arenas', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;

-- 1.5 · Área do capitão --------------------------------------------------------
alter table public.team_contacts
  add column if not exists captain_email text not null default '' check (char_length(captain_email) <= 120 and captain_email = lower(captain_email));
create index if not exists team_contacts_email_idx on public.team_contacts (captain_email) where captain_email <> '';

-- 1.6 · Ajudantes --------------------------------------------------------------
create table if not exists public.championship_helpers (
  championship_id  uuid not null references public.championships (id) on delete cascade,
  email            text not null check (email = lower(email) and char_length(email) between 3 and 120),
  created_at       timestamptz not null default now(),
  primary key (championship_id, email)
);
create index if not exists championship_helpers_email_idx on public.championship_helpers (email);
create or replace function public.is_helper(champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.championship_helpers h
    where h.championship_id = champ and h.email = lower(coalesce(auth.email(), ''))
  );
$$;
alter table public.championship_helpers enable row level security;
drop policy if exists "ajudantes: dono gerencia" on public.championship_helpers;
drop policy if exists "ajudantes: ajudante vê o próprio convite" on public.championship_helpers;
drop policy if exists "jogos: ajudante lança" on public.games;
drop policy if exists "gols: ajudante escreve" on public.goals;
create policy "ajudantes: dono gerencia" on public.championship_helpers
  for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));
create policy "ajudantes: ajudante vê o próprio convite" on public.championship_helpers
  for select using (email = lower(coalesce(auth.email(), '')));
create policy "jogos: ajudante lança" on public.games
  for update using (public.is_helper(championship_id)) with check (public.is_helper(championship_id));
create policy "gols: ajudante escreve" on public.goals
  for all using (public.is_helper(championship_id)) with check (public.is_helper(championship_id));

-- 1.7 · W.O. e cartões ---------------------------------------------------------
alter table public.games add column if not exists wo text check (wo in ('home', 'away', 'both'));
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'games_wo_both_not_ko') then
    alter table public.games add constraint games_wo_both_not_ko check (wo is distinct from 'both' or stage <> 'ko');
  end if;
end $$;
create table if not exists public.cards (
  game_id          uuid not null references public.games (id) on delete cascade,
  player_id        uuid not null references public.players (id) on delete cascade,
  team_id          uuid not null references public.teams (id) on delete cascade,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  yellow           integer not null default 0 check (yellow between 0 and 2),
  red              boolean not null default false,
  primary key (game_id, player_id),
  check (yellow > 0 or red)
);
create index if not exists cards_championship_idx on public.cards (championship_id);
alter table public.cards enable row level security;
drop policy if exists "cartões: leitura" on public.cards;
drop policy if exists "cartões: dono escreve" on public.cards;
drop policy if exists "cartões: ajudante escreve" on public.cards;
create policy "cartões: leitura" on public.cards for select using (public.can_read(championship_id));
create policy "cartões: dono escreve" on public.cards for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));
create policy "cartões: ajudante escreve" on public.cards for all using (public.is_helper(championship_id)) with check (public.is_helper(championship_id));

-- 1.8 · Repasse automático -----------------------------------------------------
create table if not exists public.payout_accounts (
  owner_id         uuid primary key references auth.users (id) on delete cascade,
  asaas_wallet_id  text not null check (asaas_wallet_id ~ '^[0-9a-fA-F-]{36}$'),
  updated_at       timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
drop policy if exists "repasse: dono gerencia" on public.payout_accounts;
create policy "repasse: dono gerencia" on public.payout_accounts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
alter table public.payments
  add column if not exists payout          text not null default 'manual' check (payout in ('automatico', 'manual')),
  add column if not exists split_wallet_id text,
  add column if not exists split_percent   numeric(7, 4) check (split_percent between 0 and 100);

-- 1.11 a 1.15 · Gestão: repasse manual feito, devolução de PIX e lembrete de pagamento pendente.

-- Quando a Campia transferiu manualmente o valor ao organizador (repasse manual).
alter table public.payments add column if not exists manual_payout_done_at timestamptz;
-- Quando o capitão recebeu o e-mail lembrando do PIX pendente (envia uma vez só).
alter table public.payments add column if not exists reminder_sent_at timestamptz;
-- Devolução (estorno) do PIX.
alter table public.payments add column if not exists refunded_at timestamptz;

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pendente', 'pago', 'pago_tarde', 'expirado', 'cancelado', 'estornado'));

-- 1.18 · Lista de espera ------------------------------------------------
-- Lista de espera: quando o campeonato lota, o time entra na fila e é avisado por e-mail se abrir vaga.
create table if not exists public.waitlist (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  team_name        text not null check (char_length(team_name) between 2 and 40),
  captain_name     text not null default '' check (char_length(captain_name) <= 60),
  email            text not null check (email = lower(email) and char_length(email) between 3 and 120),
  phone            text not null default '' check (phone ~ '^[0-9]{0,11}$'),
  created_at       timestamptz not null default now(),
  notified_at      timestamptz,
  unique (championship_id, email)
);
create index if not exists waitlist_championship_idx on public.waitlist (championship_id, created_at);

alter table public.waitlist enable row level security;
-- Entrar na fila é feito pelo servidor (service role); o dono vê e remove.
drop policy if exists "espera: dono lê" on public.waitlist;
drop policy if exists "espera: dono remove" on public.waitlist;
create policy "espera: dono lê" on public.waitlist for select using (public.is_owner(championship_id));
create policy "espera: dono remove" on public.waitlist for delete using (public.is_owner(championship_id));

-- 1.19 · Lotes de preço e cupons ----------------------------------------
-- Lotes de preço (valor por data) e cupons de desconto na inscrição.
alter table public.championships add column if not exists price_tiers jsonb not null default '[]';

create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  code             text not null check (code ~ '^[A-Z0-9]{3,20}$'),
  percent          integer check (percent between 1 and 100),
  amount_cents     integer check (amount_cents > 0),
  max_uses         integer check (max_uses > 0),
  created_at       timestamptz not null default now(),
  unique (championship_id, code),
  check ((percent is null) <> (amount_cents is null))
);
alter table public.coupons enable row level security;
-- Só o dono vê e gerencia; a validação na inscrição é feita pelo servidor.
drop policy if exists "cupons: dono gerencia" on public.coupons;
create policy "cupons: dono gerencia" on public.coupons
  for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));

alter table public.payments add column if not exists coupon_code text;
alter table public.payments add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0);

-- 1.20 · Placar ao vivo -------------------------------------------------
-- Placar ao vivo: o organizador ou ajudante vai atualizando durante o jogo; o resultado final continua em home_score/away_score.
alter table public.games add column if not exists live boolean not null default false;
alter table public.games add column if not exists live_home integer not null default 0 check (live_home >= 0);
alter table public.games add column if not exists live_away integer not null default 0 check (live_away >= 0);
alter table public.games add column if not exists live_started_at timestamptz;
create index if not exists games_live_idx on public.games (championship_id) where live;

-- 1.21 · Votação do craque ----------------------------------------------
-- Votação do craque do campeonato: 1 voto por pessoa (login) e categoria; resultado só sai quando o organizador encerra.
alter table public.championships add column if not exists voting text not null default 'fechada'
  check (voting in ('fechada', 'aberta', 'encerrada'));

create table if not exists public.votes (
  championship_id  uuid not null references public.championships (id) on delete cascade,
  category         text not null check (category in ('craque', 'goleiro', 'revelacao')),
  player_id        uuid not null references public.players (id) on delete cascade,
  voter_id         uuid not null references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (championship_id, category, voter_id)
);

create or replace function public.voting_open(champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.championships where id = champ and voting = 'aberta');
$$;
create or replace function public.player_in(champ uuid, player uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players where id = player and championship_id = champ);
$$;

alter table public.votes enable row level security;
drop policy if exists "votos: vê o próprio" on public.votes;
drop policy if exists "votos: vota com a votação aberta" on public.votes;
drop policy if exists "votos: muda o próprio voto" on public.votes;
create policy "votos: vê o próprio" on public.votes for select using (voter_id = auth.uid());
create policy "votos: vota com a votação aberta" on public.votes for insert
  with check (voter_id = auth.uid() and public.voting_open(championship_id) and public.player_in(championship_id, player_id));
create policy "votos: muda o próprio voto" on public.votes for update
  using (voter_id = auth.uid() and public.voting_open(championship_id))
  with check (voter_id = auth.uid() and public.voting_open(championship_id) and public.player_in(championship_id, player_id));

-- Resultado (contagem por atleta): o dono vê a qualquer momento; o público, depois de encerrada.
create or replace function public.vote_results(champ uuid)
returns table (category text, player_id uuid, total bigint)
language sql stable security definer set search_path = public as $$
  select v.category, v.player_id, count(*) as total
    from public.votes v
   where v.championship_id = champ
     and (public.is_owner(champ) or exists (select 1 from public.championships c where c.id = champ and c.voting = 'encerrada'))
   group by v.category, v.player_id
   order by v.category, total desc;
$$;
revoke all on function public.vote_results(uuid) from public;
grant execute on function public.vote_results(uuid) to anon, authenticated, service_role;

-- 1.23.0 · Estatísticas de visitas --------------------------------------
-- Estatísticas de visitas: contagem por dia, página e origem. Só números, sem IP nem dado pessoal.
create table if not exists public.page_views (
  championship_id  uuid not null references public.championships (id) on delete cascade,
  day              date not null,
  page             text not null check (page in ('pagina', 'inscricao')),
  source           text not null check (source in ('whatsapp', 'instagram', 'facebook', 'google', 'busca', 'email', 'campia', 'direto', 'outros')),
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
  src text := case when p_source in ('whatsapp', 'instagram', 'facebook', 'google', 'busca', 'email', 'campia', 'direto') then p_source else 'outros' end;
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

-- 1.26.0 · Patrocinadores -----------------------------------------------
-- Patrocinadores do campeonato: aparecem na página pública, na impressão e nas artes.
create table if not exists public.sponsors (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 60),
  url              text not null default '' check (url = '' or (url ~ '^https?://' and char_length(url) <= 200)),
  logo_url         text not null default '' check (char_length(logo_url) <= 400),
  tier             text not null default 'apoio' check (tier in ('master', 'apoio')),
  created_at       timestamptz not null default now()
);
create index if not exists sponsors_championship_idx on public.sponsors (championship_id, created_at);

alter table public.sponsors enable row level security;
drop policy if exists "patrocinio: leitura" on public.sponsors;
drop policy if exists "patrocinio: dono cria" on public.sponsors;
drop policy if exists "patrocinio: dono apaga" on public.sponsors;
create policy "patrocinio: leitura" on public.sponsors for select using (public.can_read(championship_id));
create policy "patrocinio: dono cria" on public.sponsors for insert with check (public.is_owner(championship_id));
create policy "patrocinio: dono apaga" on public.sponsors for delete using (public.is_owner(championship_id));

-- 1.27.0 · Presença nos jogos -------------------------------------------
-- Check-in: quais atletas estavam presentes em cada jogo (marcado pelo dono ou pelo ajudante).
create table if not exists public.checkins (
  game_id          uuid not null references public.games (id) on delete cascade,
  player_id        uuid not null references public.players (id) on delete cascade,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (game_id, player_id)
);
create index if not exists checkins_championship_idx on public.checkins (championship_id);

-- O atleta precisa ser de um dos dois times do jogo, no mesmo campeonato.
create or replace function public.player_in_game(p_game uuid, p_player uuid, p_champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.games g join public.players p on p.championship_id = g.championship_id
    where g.id = p_game and p.id = p_player and g.championship_id = p_champ
      and p.team_id in (g.home_team_id, g.away_team_id)
  );
$$;

alter table public.checkins enable row level security;
drop policy if exists "presenca: equipe lê" on public.checkins;
drop policy if exists "presenca: equipe marca" on public.checkins;
drop policy if exists "presenca: equipe desmarca" on public.checkins;
create policy "presenca: equipe lê" on public.checkins for select
  using (public.is_owner(championship_id) or public.is_helper(championship_id));
create policy "presenca: equipe marca" on public.checkins for insert
  with check ((public.is_owner(championship_id) or public.is_helper(championship_id)) and public.player_in_game(game_id, player_id, championship_id));
create policy "presenca: equipe desmarca" on public.checkins for delete
  using (public.is_owner(championship_id) or public.is_helper(championship_id));

-- 1.28.0 · Perfil do atleta ---------------------------------------------
-- Perfil do atleta: a pessoa (login por e-mail) liga os registros de atleta dela em cada campeonato.
create table if not exists public.athletes (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  handle      text not null unique check (handle ~ '^[a-z0-9-]{3,40}$'),
  name        text not null check (char_length(name) between 2 and 60),
  city        text not null default '' check (char_length(city) <= 60),
  state       text not null default '' check (state = '' or state ~ '^[A-Z]{2}$'),
  bio         text not null default '' check (char_length(bio) <= 200),
  created_at  timestamptz not null default now()
);
alter table public.athletes enable row level security;
drop policy if exists "atleta: leitura pública" on public.athletes;
drop policy if exists "atleta: próprio cria" on public.athletes;
drop policy if exists "atleta: próprio altera" on public.athletes;
drop policy if exists "atleta: próprio apaga" on public.athletes;
create policy "atleta: leitura pública" on public.athletes for select using (true);
create policy "atleta: próprio cria" on public.athletes for insert with check (user_id = auth.uid());
create policy "atleta: próprio altera" on public.athletes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "atleta: próprio apaga" on public.athletes for delete using (user_id = auth.uid());

-- Capitão do time = quem fez a inscrição com aquele e-mail.
create or replace function public.is_team_captain(p_team uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_contacts tc
    where tc.team_id = p_team and tc.captain_email <> '' and tc.captain_email = lower(coalesce(auth.email(), ''))
  );
$$;

-- "Sou eu": pedido para ligar um atleta do campeonato ao perfil. Capitão do time ou organizador aprova.
create table if not exists public.player_claims (
  player_id        uuid primary key references public.players (id) on delete cascade,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  team_id          uuid not null references public.teams (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  status           text not null default 'pendente' check (status in ('pendente', 'aprovado')),
  created_at       timestamptz not null default now(),
  unique (championship_id, user_id)
);
create index if not exists player_claims_user_idx on public.player_claims (user_id);

create or replace function public.claim_valid(p_player uuid, p_team uuid, p_champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players p where p.id = p_player and p.team_id = p_team and p.championship_id = p_champ);
$$;

alter table public.player_claims enable row level security;
drop policy if exists "vinculo: leitura" on public.player_claims;
drop policy if exists "vinculo: pedir" on public.player_claims;
drop policy if exists "vinculo: aprovar" on public.player_claims;
drop policy if exists "vinculo: desfazer" on public.player_claims;
create policy "vinculo: leitura" on public.player_claims for select
  using (status = 'aprovado' or user_id = auth.uid() or public.is_owner(championship_id) or public.is_team_captain(team_id));
create policy "vinculo: pedir" on public.player_claims for insert
  with check (user_id = auth.uid() and public.claim_valid(player_id, team_id, championship_id)
    and (status = 'pendente' or public.is_team_captain(team_id) or public.is_owner(championship_id)));
create policy "vinculo: aprovar" on public.player_claims for update
  using (public.is_owner(championship_id) or public.is_team_captain(team_id))
  with check ((public.is_owner(championship_id) or public.is_team_captain(team_id)) and public.claim_valid(player_id, team_id, championship_id));
create policy "vinculo: desfazer" on public.player_claims for delete
  using (user_id = auth.uid() or public.is_owner(championship_id) or public.is_team_captain(team_id));

-- 1.30.0 · Atleta avulso ------------------------------------------------
-- Atleta avulso: quem está sem time entra na lista "procuro time" do campeonato.
-- O WhatsApp só aparece para os capitães do campeonato e para o organizador.
create table if not exists public.free_agents (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 2 and 60),
  position         text not null default '' check (char_length(position) <= 40),
  phone            text not null check (phone ~ '^[0-9]{10,11}$'),
  note             text not null default '' check (char_length(note) <= 200),
  created_at       timestamptz not null default now(),
  unique (championship_id, user_id)
);
create index if not exists free_agents_championship_idx on public.free_agents (championship_id, created_at);

create or replace function public.is_captain_in(p_champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_contacts tc
    where tc.championship_id = p_champ and tc.captain_email <> '' and tc.captain_email = lower(coalesce(auth.email(), ''))
  );
$$;

alter table public.free_agents enable row level security;
drop policy if exists "avulso: leitura com telefone" on public.free_agents;
drop policy if exists "avulso: próprio entra" on public.free_agents;
drop policy if exists "avulso: próprio altera" on public.free_agents;
drop policy if exists "avulso: sair" on public.free_agents;
create policy "avulso: leitura com telefone" on public.free_agents for select
  using (user_id = auth.uid() or public.is_owner(championship_id) or public.is_captain_in(championship_id));
create policy "avulso: próprio entra" on public.free_agents for insert
  with check (user_id = auth.uid() and public.can_read(championship_id));
create policy "avulso: próprio altera" on public.free_agents for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "avulso: sair" on public.free_agents for delete
  using (user_id = auth.uid() or public.is_owner(championship_id));

-- Lista pública, sem telefone.
create or replace function public.free_agents_public(champ uuid)
returns table (id uuid, name text, "position" text, note text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.name, f.position, f.note, f.created_at from public.free_agents f
  where f.championship_id = champ and public.can_read(champ)
  order by f.created_at;
$$;

-- 2.0.0 · Plano Pro -----------------------------------------------------
-- Plano Pro dos organizadores (assinatura mensal pela Asaas ou cortesia dada pelo dono da Campia).
create table if not exists public.plans (
  owner_id               uuid primary key references auth.users (id) on delete cascade,
  status                 text not null default 'pendente' check (status in ('pendente', 'ativo', 'cancelado')),
  source                 text not null default 'asaas' check (source in ('asaas', 'cortesia')),
  paid_until             timestamptz,
  asaas_customer_id      text,
  asaas_subscription_id  text unique,
  invoice_url            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.plans enable row level security;
-- O organizador vê o próprio plano. Gravação só pelo servidor (service role).
drop policy if exists "plano: dono lê" on public.plans;
create policy "plano: dono lê" on public.plans for select using (owner_id = auth.uid());

-- Pro = pago (ou cortesia) até uma data no futuro. Usado pelas páginas públicas (sem marca, patrocinadores).
create or replace function public.pro_owner(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plans where owner_id = p_owner and paid_until > now());
$$;
grant execute on function public.pro_owner(uuid) to anon, authenticated;

-- Taxa da Campia gravada em cada inscrição (o Pro paga menos; muda se o plano mudar depois).
alter table public.payments add column if not exists fee_percent numeric(7, 4) check (fee_percent between 0 and 100);

-- 2.3.0 · Saúde do sistema ----------------------------------------------
-- Saúde do sistema: registro de falhas (PIX, webhook, agendador, e-mail) e último sinal de vida de cada parte.
-- Só o servidor (service role) lê e grava: nenhuma política de acesso para usuários.
create table if not exists public.system_events (
  id          bigint generated always as identity primary key,
  kind        text not null check (char_length(kind) between 1 and 30),
  message     text not null default '' check (char_length(message) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists system_events_kind_idx on public.system_events (kind, created_at desc);
alter table public.system_events enable row level security;

create table if not exists public.system_status (
  key   text primary key check (char_length(key) <= 60),
  at    timestamptz not null default now(),
  info  text not null default '' check (char_length(info) <= 300)
);
alter table public.system_status enable row level security;

-- 2.4.0 · Indique uma arena ---------------------------------------------
-- Indique uma arena: código de indicação de cada organizador e quem chegou por ele.
create table if not exists public.referral_codes (
  owner_id    uuid primary key references auth.users (id) on delete cascade,
  code        text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  created_at  timestamptz not null default now()
);
create table if not exists public.referrals (
  referred_id  uuid primary key references auth.users (id) on delete cascade,
  referrer_id  uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  rewarded_at  timestamptz,
  check (referred_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
-- O organizador vê o próprio código e as próprias indicações. Gravação só pelo servidor.
drop policy if exists "indicacao: dono lê código" on public.referral_codes;
drop policy if exists "indicacao: quem indicou lê" on public.referrals;
create policy "indicacao: dono lê código" on public.referral_codes for select using (owner_id = auth.uid());
create policy "indicacao: quem indicou lê" on public.referrals for select using (referrer_id = auth.uid());

-- 2.5.0 · Inscrição no cartão -------------------------------------------
-- Inscrição no cartão de crédito (pela página de pagamento do Asaas), com parcelamento opcional.
-- 0 = não aceita cartão; 1 = só à vista; N = até N parcelas.
alter table public.championships add column if not exists card_installments integer not null default 0 check (card_installments between 0 and 12);
alter table public.payments add column if not exists method text not null default 'pix' check (method in ('pix', 'cartao'));
alter table public.payments add column if not exists invoice_url text;
alter table public.payments add column if not exists installments integer check (installments between 1 and 12);
-- Parcelado no Asaas vira um "parcelamento": a devolução é feita nele, não só na 1ª parcela.
alter table public.payments add column if not exists provider_installment_id text;

select 'Banco da Campia atualizado até a versão 2.5.0' as resultado;
