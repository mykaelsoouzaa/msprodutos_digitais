-- Página da arena: um perfil público por conta de organizador, em /arena/<slug>.

create table public.arenas (
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
create policy "arena: leitura pública" on public.arenas for select using (true);
create policy "arena: dono cria" on public.arenas for insert with check (owner_id = auth.uid());
create policy "arena: dono altera" on public.arenas for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "arena: dono apaga" on public.arenas for delete using (owner_id = auth.uid());

-- Pasta pública para os logos (o envio é feito pelo servidor, que valida tipo e tamanho).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('arenas', 'arenas', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;
