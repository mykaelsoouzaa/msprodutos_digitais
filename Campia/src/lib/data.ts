// Leitura e gravação no banco, convertendo linhas em tipos do domínio.
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveKnockout } from './domain/standings';
import type { Championship, Game, Goal, Player, Rules, Schedule, Source, Team } from './domain/types';

/* ---------- linhas do banco ---------- */
export interface ChampionshipRow {
  id: string; owner_id: string; slug: string; name: string; sport: string; format: Championship['format'];
  fee_cents: number; location: string; city: string; state: string; online: boolean; visibility: Championship['visibility'];
  rules: Rules; schedule: Schedule; created_at: string;
}
export interface TeamRow {
  id: string; championship_id: string; slot: number; name: string; short: string; color: string; grp: string | null;
  status: Team['status']; paid: boolean; captain_name: string; reserved_until: string | null;
}
export interface PlayerRow { id: string; championship_id: string; team_id: string; name: string; number: string }
export interface GameRow {
  id: string; championship_id: string; stage: Game['stage']; grp: string | null; seq: number; label: string; name: string;
  home_team_id: string | null; away_team_id: string | null; src_home: Source | null; src_away: Source | null;
  home_score: number | null; away_score: number | null; pen_home: number | null; pen_away: number | null;
  date: string | null; time: string; field: string; sort: number;
}
export interface GoalRow { game_id: string; player_id: string; team_id: string; championship_id: string; count: number }
export interface PaymentRow {
  id: string; championship_id: string; team_id: string; amount_cents: number; provider: 'mock' | 'asaas';
  provider_id: string | null; status: 'pendente' | 'pago' | 'pago_tarde' | 'expirado' | 'cancelado';
  pix_payload: string | null; pix_image: string | null; expires_at: string | null; created_at: string; paid_at: string | null;
}

/* ---------- conversões ---------- */
export const toChampionship = (r: ChampionshipRow): Championship => ({
  id: r.id, slug: r.slug, name: r.name, sport: r.sport, format: r.format, feeCents: r.fee_cents,
  location: r.location, city: r.city, state: r.state ?? '', online: !!r.online, visibility: r.visibility, rules: r.rules, schedule: r.schedule,
});
export const toTeam = (r: TeamRow, phone = ''): Team => ({
  id: r.id, slot: r.slot, name: r.name, short: r.short, color: r.color, group: r.grp, status: r.status,
  paid: r.paid, captainName: r.captain_name, captainPhone: phone,
});
export const toPlayer = (r: PlayerRow): Player => ({ id: r.id, teamId: r.team_id, name: r.name, number: r.number });
export const toGame = (r: GameRow): Game => ({
  id: r.id, stage: r.stage, group: r.grp, seq: r.seq, label: r.label, name: r.name,
  homeId: r.home_team_id, awayId: r.away_team_id, srcHome: r.src_home, srcAway: r.src_away,
  homeScore: r.home_score, awayScore: r.away_score, penHome: r.pen_home, penAway: r.pen_away,
  date: r.date ?? '', time: r.time, field: r.field, sort: r.sort,
});
export const toGoal = (r: GoalRow): Goal => ({ gameId: r.game_id, playerId: r.player_id, teamId: r.team_id, count: r.count });

export const teamRow = (championshipId: string, t: Team): Omit<TeamRow, 'reserved_until'> => ({
  id: t.id, championship_id: championshipId, slot: t.slot, name: t.name, short: t.short, color: t.color, grp: t.group,
  status: t.status, paid: t.paid, captain_name: t.captainName,
});
export const gameRow = (championshipId: string, g: Game): GameRow => ({
  id: g.id, championship_id: championshipId, stage: g.stage, grp: g.group, seq: g.seq, label: g.label, name: g.name,
  home_team_id: g.homeId, away_team_id: g.awayId, src_home: g.srcHome, src_away: g.srcAway,
  home_score: g.homeScore, away_score: g.awayScore, pen_home: g.penHome, pen_away: g.penAway,
  date: g.date || null, time: g.time, field: g.field, sort: g.sort,
});

/* ---------- carregar um campeonato inteiro ---------- */
export interface ChampData {
  row: ChampionshipRow;
  champ: Championship;
  teams: Team[];
  players: Player[];
  games: Game[];
  goals: Goal[];
}

export async function loadChampionship(
  db: SupabaseClient, by: { id: string } | { slug: string }, opts: { withContacts?: boolean } = {},
): Promise<ChampData | null> {
  const q = db.from('championships').select('*');
  const { data: row } = await ('id' in by ? q.eq('id', by.id) : q.eq('slug', by.slug)).maybeSingle<ChampionshipRow>();
  if (!row) return null;

  const [teams, players, games, goals, contacts] = await Promise.all([
    db.from('teams').select('*').eq('championship_id', row.id).order('slot').returns<TeamRow[]>(),
    db.from('players').select('*').eq('championship_id', row.id).order('number').returns<PlayerRow[]>(),
    db.from('games').select('*').eq('championship_id', row.id).order('sort').returns<GameRow[]>(),
    db.from('goals').select('*').eq('championship_id', row.id).returns<GoalRow[]>(),
    opts.withContacts
      ? db.from('team_contacts').select('team_id, captain_phone').eq('championship_id', row.id).returns<Array<{ team_id: string; captain_phone: string }>>()
      : Promise.resolve({ data: [] as Array<{ team_id: string; captain_phone: string }> }),
  ]);
  const phones = new Map((contacts.data ?? []).map(c => [c.team_id, c.captain_phone]));

  return {
    row,
    champ: toChampionship(row),
    teams: (teams.data ?? []).map(t => toTeam(t, phones.get(t.id) ?? '')),
    players: (players.data ?? []).map(toPlayer),
    games: (games.data ?? []).map(toGame),
    goals: (goals.data ?? []).map(toGoal),
  };
}

/**
 * Recalcula os confrontos do mata-mata depois de um resultado e grava só os jogos que mudaram.
 * Jogos que perderam um dos times têm o placar e os gols apagados.
 */
export async function persistKnockout(db: SupabaseClient, data: ChampData) {
  const changed = resolveKnockout(data.champ, data.games, data.teams);
  for (const id of changed) {
    const g = data.games.find(x => x.id === id)!;
    const { error } = await db.from('games').update({
      home_team_id: g.homeId, away_team_id: g.awayId, home_score: null, away_score: null, pen_home: null, pen_away: null,
    }).eq('id', id);
    if (error) throw error;
    await db.from('goals').delete().eq('game_id', id);
  }
  return changed.length;
}
