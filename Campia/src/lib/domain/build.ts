// Monta times (vagas), jogos e agenda de um campeonato novo.
import type { Format, Game, Schedule, Source, Team } from './types';

export const TEAM_COLORS = ['#e11d48', '#2563eb', '#f59e0b', '#16a34a', '#7c3aed', '#0891b2', '#db2777', '#ea580c',
  '#0d9488', '#4f46e5', '#65a30d', '#9333ea', '#be123c', '#0369a1', '#a16207', '#15803d'];

const uuid = () => globalThis.crypto.randomUUID();

/** Quantidade de times aceita em cada formato. Retorna a mensagem de erro, ou null se estiver ok. */
export function teamCountError(format: Format, n: number): string | null {
  if (!Number.isInteger(n)) return 'Número de times inválido';
  if (format === 'pontos' && (n < 3 || n > 16)) return 'Pontos corridos: de 3 a 16 times';
  if (format === 'grupos' && (n < 6 || n > 16)) return 'Grupos + mata-mata: de 6 a 16 times';
  if (format === 'mata' && ![4, 8, 16].includes(n)) return 'Mata-mata: 4, 8 ou 16 times';
  return null;
}

/** Todos contra todos (método do círculo). Retorna as rodadas como pares [mandante, visitante]. */
export function roundRobin(ids: string[]): Array<Array<[string, string]>> {
  const t: Array<string | null> = [...ids];
  if (t.length % 2) t.push(null);
  const n = t.length;
  const rounds: Array<Array<[string, string]>> = [];
  let arr = [...t];
  for (let r = 0; r < n - 1; r++) {
    const games: Array<[string, string]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a && b) games.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(games);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return rounds;
}

const STAGE_NAMES: Record<number, string> = { 8: 'Oitavas', 4: 'Quartas', 2: 'Semifinal', 1: 'Final' };
const stageName = (gamesInRound: number) => STAGE_NAMES[gamesInRound] ?? `Fase de ${gamesInRound * 2}`;
const shortStage = (s: string) => (s === 'Semifinal' ? 'Semi' : s);

export function newGame(partial: Partial<Game>): Game {
  return {
    id: uuid(), stage: 'liga', group: null, seq: 1, label: '', name: '', homeId: null, awayId: null,
    srcHome: null, srcAway: null, homeScore: null, awayScore: null, penHome: null, penAway: null, wo: null,
    date: '', time: '', field: '', sort: 0, ...partial,
  };
}

/** Cria as fases de mata-mata a partir dos confrontos da primeira fase eliminatória. */
function addKnockout(games: Game[], first: Game[], seq0: number) {
  let prev = first;
  let seq = seq0;
  for (;;) {
    const label = stageName(prev.length);
    prev.forEach((g, i) => {
      g.stage = 'ko'; g.seq = seq; g.label = label;
      g.name = label === 'Final' ? 'Final' : `${shortStage(label)} ${i + 1}`;
    });
    games.push(...prev);
    if (prev.length === 1) break;
    const next: Game[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(newGame({ srcHome: { type: 'win', game: prev[i].id }, srcAway: { type: 'win', game: prev[i + 1].id } }));
    }
    prev = next;
    seq++;
  }
}

/** Cruzamentos do mata-mata por número de grupos e classificados por grupo. */
const KO_SEEDS: Record<string, Array<[string, string]>> = {
  '2-1': [['A1', 'B1']],
  '2-2': [['A1', 'B2'], ['B1', 'A2']],
  '2-4': [['A1', 'B4'], ['B2', 'A3'], ['B1', 'A4'], ['A2', 'B3']],
  '4-1': [['A1', 'B1'], ['C1', 'D1']],
  '4-2': [['A1', 'B2'], ['C1', 'D2'], ['B1', 'A2'], ['D1', 'C2']],
};

/** Classificados por grupo permitidos para essa divisão de grupos. */
export function qualifyOptions(teams: Team[]): number[] {
  const groups = [...new Set(teams.map(t => t.group).filter((g): g is string => !!g))];
  if (!groups.length) return [];
  const min = Math.min(...groups.map(g => teams.filter(t => t.group === g).length));
  return (groups.length === 4 ? [1, 2] : [1, 2, 4]).filter(q => q <= min);
}

export interface PlanInput {
  format: Format;
  teamCount: number;
  schedule: Schedule;
  qualify?: number;
}

export interface Plan {
  teams: Team[];
  games: Game[];
  qualify: number;
}

/** Gera as vagas (times ainda abertos), os jogos e a agenda. */
export function buildPlan({ format, teamCount, schedule, qualify = 2 }: PlanInput): Plan {
  const err = teamCountError(format, teamCount);
  if (err) throw new Error(err);

  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    id: uuid(), slot: i + 1, name: `Vaga ${i + 1}`, short: `V${i + 1}`, color: TEAM_COLORS[i % TEAM_COLORS.length],
    group: null, status: 'aberta', paid: false, captainName: '', captainPhone: '',
  }));
  const games: Game[] = [];

  if (format === 'pontos') {
    roundRobin(teams.map(t => t.id)).forEach((round, ri) =>
      round.forEach(([h, a]) => games.push(newGame({ stage: 'liga', seq: ri + 1, label: `Rodada ${ri + 1}`, homeId: h, awayId: a }))));
  }

  if (format === 'grupos') {
    const groupCount = teamCount >= 12 ? 4 : 2;
    const letters = 'ABCD'.slice(0, groupCount).split('');
    teams.forEach((t, i) => { t.group = letters[i % groupCount]; });
    letters.forEach(g => roundRobin(teams.filter(t => t.group === g).map(t => t.id)).forEach((round, ri) =>
      round.forEach(([h, a]) => games.push(newGame({ stage: 'grupo', group: g, seq: ri + 1, label: `Rodada ${ri + 1}`, homeId: h, awayId: a })))));
    const options = qualifyOptions(teams);
    if (!options.includes(qualify)) qualify = options.includes(2) ? 2 : 1;
    const lastRound = Math.max(...games.map(g => g.seq));
    const src = (s: string): Source => ({ type: 'grp', g: s[0], pos: Number(s.slice(1)) });
    const first = KO_SEEDS[`${groupCount}-${qualify}`].map(([h, a]) => newGame({ srcHome: src(h), srcAway: src(a) }));
    addKnockout(games, first, lastRound + 1);
  }

  if (format === 'mata') {
    const first: Game[] = [];
    for (let i = 0; i < teamCount / 2; i++) {
      first.push(newGame({ srcHome: { type: 'team', id: teams[i].id }, srcAway: { type: 'team', id: teams[teamCount - 1 - i].id } }));
    }
    addKnockout(games, first, 1);
  }

  applySchedule(games, schedule);
  return { teams, games, qualify };
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Distribui os jogos: uma rodada por semana a partir de `start`,
 * preenchendo os campos em paralelo e depois o próximo horário.
 * `keep` diz quais jogos não devem ser remarcados (já realizados).
 */
export function applySchedule(games: Game[], schedule: Schedule, keep: (g: Game) => boolean = () => false) {
  const fields = schedule.fields.length ? schedule.fields : ['Campo 1'];
  const times = schedule.times.length ? schedule.times : ['09:00'];
  const bySeq = new Map<number, Game[]>();
  games.forEach(g => bySeq.set(g.seq, [...(bySeq.get(g.seq) ?? []), g]));
  let sort = 0;
  [...bySeq.keys()].sort((a, b) => a - b).forEach(seq => {
    const date = addDays(schedule.start, 7 * (seq - 1));
    bySeq.get(seq)!.forEach((g, i) => {
      g.sort = sort++;
      if (keep(g)) return;
      g.date = date;
      g.time = times[Math.floor(i / fields.length) % times.length];
      g.field = fields[i % fields.length];
    });
  });
}
