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
