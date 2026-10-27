// Votação do craque do campeonato.
import { sportRules } from './domain/sports';
import type { Player, Team } from './domain/types';

export type VoteCategory = 'craque' | 'goleiro' | 'revelacao';
export type VotingState = 'fechada' | 'aberta' | 'encerrada';

const LABELS: Record<VoteCategory, string> = { craque: 'Craque do campeonato', goleiro: 'Melhor goleiro', revelacao: 'Revelação' };

/** Categorias de cada esporte: goleiro só onde existe goleiro. */
export function categoriesFor(sport: string): Array<[VoteCategory, string]> {
  const g = sportRules(sport).group;
  const hasKeeper = (g === 'Futebol' && sport !== 'Futevôlei') || sport === 'Handebol';
  return (['craque', ...(hasKeeper ? ['goleiro'] : []), 'revelacao'] as VoteCategory[]).map(c => [c, LABELS[c]]);
}

export interface VoteResult { category: string; player_id: string; total: number }
export interface Ranked { player: Player; team: Team | undefined; total: number }

/** Top 3 de cada categoria a partir das contagens do banco. */
export function ranking(results: VoteResult[], players: Player[], teams: Team[], category: VoteCategory): Ranked[] {
  return results.filter(r => r.category === category)
    .map(r => {
      const player = players.find(p => p.id === r.player_id);
      return player ? { player, team: teams.find(t => t.id === player.teamId), total: Number(r.total) } : null;
    })
    .filter((x): x is Ranked => !!x)
    .sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name))
    .slice(0, 3);
}
