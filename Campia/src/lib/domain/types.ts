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
  /** Só carregado para o dono do campeonato. */
  captainEmail?: string;
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
  /** W.O.: qual time faltou ('home', 'away') ou os dois ('both'). */
  wo: WO;
  /** Placar ao vivo enquanto o jogo acontece (não conta na tabela). */
  live?: { home: number; away: number; since: string | null } | null;
  date: string;   // AAAA-MM-DD ou ''
  time: string;   // HH:MM ou ''
  field: string;
  sort: number;
}

export type WO = 'home' | 'away' | 'both' | null;

/** Cartões de um atleta numa partida. Dois amarelos no mesmo jogo contam como expulsão. */
export interface Card {
  gameId: string;
  playerId: string;
  teamId: string;
  yellow: number;
  red: boolean;
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
  yellowLimit?: number;  // amarelos acumulados que dão 1 jogo de suspensão (padrão 3)
  drawnAt?: string;      // quando os grupos/confrontos foram sorteados (ISO)
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
  /** UF com 2 letras, ou '' */
  state: string;
  /** Disputado pela internet (só e-sports). */
  online: boolean;
  visibility: Visibility;
  rules: Rules;
  schedule: Schedule;
  /** Lotes de preço por data (o feeCents vale depois do último lote). */
  priceTiers?: Array<{ until: string; cents: number }>;
}

export interface StandingRow {
  team: Team;
  P: number; J: number; V: number; E: number; D: number; GP: number; GC: number;
}
