-- Placar ao vivo: o organizador ou ajudante vai atualizando durante o jogo; o resultado final continua em home_score/away_score.
alter table public.games add column if not exists live boolean not null default false;
alter table public.games add column if not exists live_home integer not null default 0 check (live_home >= 0);
alter table public.games add column if not exists live_away integer not null default 0 check (live_away >= 0);
alter table public.games add column if not exists live_started_at timestamptz;
create index if not exists games_live_idx on public.games (championship_id) where live;
