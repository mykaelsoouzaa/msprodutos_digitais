import type { SupabaseClient } from '@supabase/supabase-js';
import { type AthleteEntry, entryFor } from './athlete';
import { type ChampData, loadChampionship } from './data';
import type { VoteResult } from './voting';

export interface Athlete { user_id: string; handle: string; name: string; city: string; state: string; bio: string }
export interface Claim { player_id: string; championship_id: string; team_id: string; status: 'pendente' | 'aprovado'; created_at: string }

/** Campeonatos ligados ao atleta, do mais recente para o mais antigo (até 30). */
export async function loadAthleteEntries(db: SupabaseClient, userId: string, onlyApproved = true) {
  let q = db.from('player_claims').select('player_id, championship_id, team_id, status, created_at').eq('user_id', userId);
  if (onlyApproved) q = q.eq('status', 'aprovado');
  const { data: claims } = await q.order('created_at', { ascending: false }).limit(30).returns<Claim[]>();
  const list = claims ?? [];
  const loaded = await Promise.all(list.map(async c => {
    const d = await loadChampionship(db, { id: c.championship_id });
    if (!d) return null;
    const { data: votes } = d.champ.voting === 'encerrada'
      ? await db.rpc('vote_results', { champ: d.champ.id })
      : { data: [] };
    return { c, d, e: entryFor(d, c.player_id, (votes ?? []) as VoteResult[]) };
  }));
  return loaded.filter((x): x is { c: Claim; d: ChampData; e: AthleteEntry } => !!x && !!x.e);
}
