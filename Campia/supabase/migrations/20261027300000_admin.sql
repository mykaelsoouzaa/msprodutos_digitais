-- Admin da Campia: pode ver, editar e apagar qualquer campeonato, como se fosse o dono.
-- Só vale para e-mails da lista (sincronizada com ADMIN_EMAILS ao abrir o /admin)
-- e só numa sessão com a verificação em duas etapas confirmada (aal2).
create table if not exists public.platform_admins (
  email       text primary key check (email = lower(email) and char_length(email) between 3 and 120),
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security; -- sem políticas: só o servidor lê e grava

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.platform_admins a where a.email = lower(coalesce(auth.email(), '')));
$$;

-- "Dono" passa a incluir o admin: vale para times, jogos, pagamentos, cupons, patrocinadores...
create or replace function public.is_owner(champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.championships c where c.id = champ and (c.owner_id = auth.uid() or public.is_platform_admin()));
$$;

create or replace function public.can_read(champ uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.championships c
    where c.id = champ and (c.visibility in ('publico', 'link') or c.owner_id = auth.uid() or public.is_platform_admin())
  );
$$;

drop policy if exists "campeonato: leitura pública ou do dono" on public.championships;
drop policy if exists "campeonato: dono altera" on public.championships;
drop policy if exists "campeonato: dono apaga" on public.championships;
create policy "campeonato: leitura pública ou do dono" on public.championships
  for select using (visibility in ('publico', 'link') or owner_id = auth.uid() or public.is_platform_admin());
create policy "campeonato: dono altera" on public.championships
  for update using (owner_id = auth.uid() or public.is_platform_admin()) with check (owner_id = auth.uid() or public.is_platform_admin());
create policy "campeonato: dono apaga" on public.championships
  for delete using (owner_id = auth.uid() or public.is_platform_admin());
