-- Campia · esquema inicial do MVP
-- Campeonatos, vagas/times, atletas, jogos, gols e pagamentos PIX.
-- Segurança: Row Level Security em todas as tabelas.
--   · organizador (dono) lê e altera só os próprios campeonatos;
--   · qualquer pessoa lê campeonatos "publico" ou "link" (página pública);
--   · inscrição e pagamento são gravados pelo servidor com a service role,
--     via funções que reservam a vaga sem corrida entre dois times.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.championships (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  name        text not null check (char_length(name) between 3 and 80),
  sport       text not null,
  format      text not null check (format in ('pontos', 'grupos', 'mata')),
  fee_cents   integer not null default 0 check (fee_cents between 0 and 10000000),
  location    text not null default '',
  city        text not null default '',
  visibility  text not null default 'link' check (visibility in ('publico', 'link')),
  rules       jsonb not null default '{"qualify": 2, "tiebreak": ["v", "sg", "gp", "cd"]}',
  schedule    jsonb not null,
  created_at  timestamptz not null default now()
);
create index championships_owner_idx on public.championships (owner_id);

create table public.teams (
  id               uuid primary key,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  slot             integer not null,
  name             text not null,
  short            text not null default '',
  color            text not null default '#22c55e',
  grp              text,
  status           text not null default 'aberta' check (status in ('aberta', 'reservada', 'inscrita')),
  paid             boolean not null default false,
  captain_name     text not null default '',
  reserved_until   timestamptz,
  unique (championship_id, slot)
);
create index teams_championship_idx on public.teams (championship_id);

-- Contato do capitão fica separado: só o dono do campeonato lê (a página pública não vê telefones).
create table public.team_contacts (
  team_id          uuid primary key references public.teams (id) on delete cascade,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  captain_phone    text not null default ''
);

create table public.players (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  team_id          uuid not null references public.teams (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 60),
  number           text not null default ''
);
create index players_team_idx on public.players (team_id);

create table public.games (
  id               uuid primary key,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  stage            text not null check (stage in ('liga', 'grupo', 'ko')),
  grp              text,
  seq              integer not null,
  label            text not null,
  name             text not null default '',
  home_team_id     uuid references public.teams (id) on delete set null,
  away_team_id     uuid references public.teams (id) on delete set null,
  src_home         jsonb,
  src_away         jsonb,
  home_score       integer check (home_score >= 0),
  away_score       integer check (away_score >= 0),
  pen_home         integer check (pen_home >= 0),
  pen_away         integer check (pen_away >= 0),
  date             date,
  time             text not null default '',
  field            text not null default '',
  sort             integer not null default 0
);
create index games_championship_idx on public.games (championship_id);

create table public.goals (
  game_id          uuid not null references public.games (id) on delete cascade,
  player_id        uuid not null references public.players (id) on delete cascade,
  team_id          uuid not null references public.teams (id) on delete cascade,
  championship_id  uuid not null references public.championships (id) on delete cascade,
  count            integer not null check (count > 0),
  primary key (game_id, player_id)
);
create index goals_championship_idx on public.goals (championship_id);

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references public.championships (id) on delete cascade,
  team_id          uuid not null references public.teams (id) on delete cascade,
  amount_cents     integer not null check (amount_cents >= 0),
  provider         text not null check (provider in ('mock', 'asaas')),
  provider_id      text,
  -- pago_tarde: o PIX caiu depois que a reserva venceu e a vaga já foi para outro time (devolver ou encaixar)
  status           text not null default 'pendente' check (status in ('pendente', 'pago', 'pago_tarde', 'expirado', 'cancelado')),
  pix_payload      text,
  pix_image        text,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  paid_at          timestamptz
);
create index payments_team_idx on public.payments (team_id);
create unique index payments_provider_idx on public.payments (provider, provider_id) where provider_id is not null;

-- Eventos de webhook já processados (a Asaas entrega "pelo menos uma vez").
create table public.webhook_events (
  id           text primary key,
  provider     text not null,
  received_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funções auxiliares de permissão
-- ---------------------------------------------------------------------------
create or replace function public.is_owner(champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.championships c where c.id = champ and c.owner_id = auth.uid());
$$;

create or replace function public.can_read(champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.championships c
    where c.id = champ and (c.visibility in ('publico', 'link') or c.owner_id = auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.championships  enable row level security;
alter table public.teams          enable row level security;
alter table public.players        enable row level security;
alter table public.games          enable row level security;
alter table public.goals          enable row level security;
alter table public.payments       enable row level security;
alter table public.webhook_events enable row level security;
alter table public.team_contacts  enable row level security;

create policy "campeonato: leitura pública ou do dono" on public.championships
  for select using (visibility in ('publico', 'link') or owner_id = auth.uid());
create policy "campeonato: dono cria" on public.championships
  for insert with check (owner_id = auth.uid());
create policy "campeonato: dono altera" on public.championships
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "campeonato: dono apaga" on public.championships
  for delete using (owner_id = auth.uid());

-- Times, atletas, jogos e gols: leitura acompanha o campeonato; escrita só do dono.
create policy "times: leitura" on public.teams for select using (public.can_read(championship_id));
create policy "times: dono escreve" on public.teams for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));
create policy "atletas: leitura" on public.players for select using (public.can_read(championship_id));
create policy "atletas: dono escreve" on public.players for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));
create policy "jogos: leitura" on public.games for select using (public.can_read(championship_id));
create policy "jogos: dono escreve" on public.games for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));
create policy "gols: leitura" on public.goals for select using (public.can_read(championship_id));
create policy "gols: dono escreve" on public.goals for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));

create policy "contatos: só o dono" on public.team_contacts for all using (public.is_owner(championship_id)) with check (public.is_owner(championship_id));

-- Pagamentos: só o dono lê. Criação e confirmação são feitas pelo servidor (service role).
create policy "pagamentos: dono lê" on public.payments for select using (public.is_owner(championship_id));
-- webhook_events: sem políticas = ninguém além da service role.

-- ---------------------------------------------------------------------------
-- Inscrição: reservar vaga, confirmar pagamento
-- ---------------------------------------------------------------------------

-- Reserva a próxima vaga livre (ou com reserva vencida) por p_minutes.
-- "for update skip locked" impede que duas inscrições peguem a mesma vaga.
create or replace function public.reserve_slot(
  p_championship uuid, p_name text, p_short text, p_captain text, p_phone text, p_minutes integer default 30
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
begin
  select id into v_team from public.teams
   where championship_id = p_championship
     and (status = 'aberta' or (status = 'reservada' and reserved_until < now()))
   order by slot
   limit 1
   for update skip locked;

  if v_team is null then
    return null;
  end if;

  -- Uma reserva vencida pode ter deixado atletas e cobrança para trás.
  delete from public.players where team_id = v_team;
  update public.payments set status = 'expirado' where team_id = v_team and status = 'pendente';

  update public.teams
     set status = 'reservada', paid = false, name = p_name, short = p_short,
         captain_name = p_captain, reserved_until = now() + make_interval(mins => p_minutes)
   where id = v_team;

  insert into public.team_contacts (team_id, championship_id, captain_phone)
  values (v_team, p_championship, p_phone)
  on conflict (team_id) do update set captain_phone = excluded.captain_phone;
  return v_team;
end;
$$;

-- Marca o pagamento como pago e o time como inscrito. Idempotente.
-- Se a reserva já tinha vencido (pagamento "expirado"), registra "pago_tarde" e não mexe na vaga,
-- que pode já pertencer a outro time.
create or replace function public.confirm_payment(p_payment uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
  v_status text;
begin
  select team_id, status into v_team, v_status from public.payments where id = p_payment for update;
  if v_team is null then
    return false;
  end if;
  if v_status in ('pago', 'pago_tarde') then
    return v_status = 'pago';
  end if;
  if v_status <> 'pendente' then
    update public.payments set status = 'pago_tarde', paid_at = now() where id = p_payment;
    return false;
  end if;

  update public.payments set status = 'pago', paid_at = now() where id = p_payment;
  update public.teams set status = 'inscrita', paid = true, reserved_until = null where id = v_team;
  return true;
end;
$$;

revoke all on function public.reserve_slot(uuid, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.confirm_payment(uuid) from public, anon, authenticated;
grant execute on function public.reserve_slot(uuid, text, text, text, text, integer) to service_role;
grant execute on function public.confirm_payment(uuid) to service_role;
