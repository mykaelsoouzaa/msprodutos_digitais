// Situação de um campeonato para listagens (explorar, página da arena, área do capitão).

export type ChampStatus = 'abertas' | 'andamento' | 'embreve' | 'encerrado';

export const STATUS_LABEL: Record<ChampStatus, string> = {
  abertas: 'Inscrições abertas',
  andamento: 'Em andamento',
  embreve: 'Em breve',
  encerrado: 'Encerrado',
};
export const STATUS_BADGE: Record<ChampStatus, string> = { abertas: 'ok', andamento: 'wait', embreve: 'open', encerrado: 'open' };

/** open: vagas não pagas · played: jogos com placar · total: jogos */
export function champStatus({ open, played, total }: { open: number; played: number; total: number }): ChampStatus {
  if (total > 0 && played >= total) return 'encerrado';
  if (played > 0) return 'andamento';
  if (open > 0) return 'abertas';
  return 'embreve';
}

const ORDER: ChampStatus[] = ['abertas', 'andamento', 'embreve', 'encerrado'];

/** Abertas primeiro; dentro de cada grupo, os que começam antes. Encerrados: os mais recentes primeiro. */
export function sortForListing<T extends { status: ChampStatus; start: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const d = ORDER.indexOf(a.status) - ORDER.indexOf(b.status);
    if (d) return d;
    return a.status === 'encerrado' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start);
  });
}

/** Texto seguro para usar dentro de um filtro ilike do PostgREST. */
export const likeTerm = (s: string) => `%${s.trim().slice(0, 60).replace(/[%_\\,()]/g, ' ')}%`;

/** Campos que as listagens leem do banco (inclui times e jogos embutidos). */
export const LISTING_SELECT =
  'id, slug, name, sport, format, fee_cents, location, city, state, online, schedule, owner_id, teams(status), games(home_score)';

export interface ListingRow {
  id: string; slug: string; name: string; sport: string; format: 'pontos' | 'grupos' | 'mata'; fee_cents: number;
  location: string; city: string; state: string; online: boolean; schedule: { start: string }; owner_id: string;
  teams: Array<{ status: string }>; games: Array<{ home_score: number | null }>;
}

export interface ListingItem extends ListingRow { status: ChampStatus; open: number; start: string }

export function toListing(rows: ListingRow[]): ListingItem[] {
  return sortForListing(rows.map(r => {
    const open = (r.teams ?? []).filter(t => t.status !== 'inscrita').length;
    const played = (r.games ?? []).filter(g => g.home_score !== null).length;
    return { ...r, open, start: r.schedule?.start ?? '', status: champStatus({ open, played, total: (r.games ?? []).length }) };
  }));
}
