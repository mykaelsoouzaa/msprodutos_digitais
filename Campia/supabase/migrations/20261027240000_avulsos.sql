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
