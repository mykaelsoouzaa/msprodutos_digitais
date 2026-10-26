-- Explorar campeonatos: busca dos públicos por estado e cidade.
create index if not exists championships_public_place_idx
  on public.championships (state, city) where visibility = 'publico';
