// Tipos do domínio. Não dependem de banco nem de framework:
// as mesmas funções rodam no servidor, no navegador e nos testes.

export type Format = 'pontos' | 'grupos' | 'mata';
export type Stage = 'liga' | 'grupo' | 'ko';
export type Visibility = 'publico' | 'link';
export type TeamStatus = 'aberta' | 'reservada' | 'inscrita';

/** De onde vem um time num jogo de mata-mata ainda não definido. */
export type Source =
  | { type: 'team'; id: string }
  | { type: 'grp'; g: string; pos: number }
  | { type: 'win'; game: string };

export interface Team {
  id: string;
  slot: number;
  name: string;
  short: string;
  color: string;
  group: string | null;
  status: TeamStatus;
  paid: boolean;
  captainName: string;
  captainPhone: string;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  number: string;
}

export interface Game {
  id: string;
  stage: Stage;
  group: string | null;
  seq: number;
  label: string;
  name: string;
  homeId: string | null;
  awayId: string | null;
  srcHome: Source | null;
  srcAway: Source | null;
  homeScore: number | null;
  awayScore: number | null;
  penHome: number | null;
  penAway: number | null;
  date: string;   // AAAA-MM-DD ou ''
  time: string;   // HH:MM ou ''
  field: string;
  sort: number;
}

export interface Goal {
  gameId: string;
  playerId: string;
  teamId: string;
  count: number;
}

export interface Schedule {
  start: string;     // AAAA-MM-DD da primeira rodada
  times: string[];   // horários disponíveis por dia
  fields: string[];  // campos ou quadras
}

export type Tiebreak = 'v' | 'sg' | 'gp' | 'cd';

export interface Rules {
  qualify: number;       // classificados por grupo
  tiebreak: Tiebreak[];  // ordem dos critérios depois dos pontos
}

export interface Championship {
  id: string;
  slug: string;
  name: string;
  sport: string;
  format: Format;
  feeCents: number;
  location: string;
  city: string;
  visibility: Visibility;
  rules: Rules;
  schedule: Schedule;
}

export interface StandingRow {
  team: Team;
  P: number; J: number; V: number; E: number; D: number; GP: number; GC: number;
}
