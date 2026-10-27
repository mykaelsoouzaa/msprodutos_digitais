'use server';
// Check-in no dia do jogo: o mesário marca quem está presente em cada time.
import { redirect } from 'next/navigation';
import { roleIn } from '@/lib/access';
import { loadChampionship } from '@/lib/data';
import { discipline } from '@/lib/domain/discipline';
import { createClient } from '@/lib/supabase/server';

export async function saveCheckin(formData: FormData) {
  const champId = String(formData.get('championship'));
  const gameId = String(formData.get('game'));
  const back = `/painel/${champId}/jogo/${gameId}`;
  const go = (k: 'ok' | 'erro', msg: string): never => redirect(`${back}?${k}=${encodeURIComponent(msg)}#presenca`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const data = await loadChampionship(supabase, { id: champId });
  const g = data?.games.find(x => x.id === gameId);
  if (!data || !g || !g.homeId || !g.awayId) go('erro', 'Jogo não encontrado');
  if (!(await roleIn(supabase, data!.row, user))) go('erro', 'Você não tem acesso a este campeonato');

  const roster = data!.players.filter(p => p.teamId === g!.homeId || p.teamId === g!.awayId);
  const present = roster.filter(p => formData.get(`in_${p.id}`) === '1');

  const del = await supabase.from('checkins').delete().eq('game_id', gameId);
  if (del.error) go('erro', 'Não foi possível salvar a presença');
  if (present.length) {
    const { error } = await supabase.from('checkins').insert(present.map(p => ({ game_id: gameId, player_id: p.id, championship_id: champId })));
    if (error) go('erro', 'Não foi possível salvar a presença');
  }

  const out = discipline(data!.games, data!.cards, data!.players, data!.teams, data!.champ.rules.yellowLimit).suspended.get(gameId) ?? new Set<string>();
  const suspendedIn = present.filter(p => out.has(p.id)).map(p => p.name);
  const count = (teamId: string) => present.filter(p => p.teamId === teamId).length;
  const home = data!.teams.find(t => t.id === g!.homeId)!, away = data!.teams.find(t => t.id === g!.awayId)!;
  const msg = `Presença salva: ${home.short} ${count(home.id)} · ${away.short} ${count(away.id)}`;
  go('ok', suspendedIn.length ? `${msg}. Atenção: ${suspendedIn.join(', ')} ${suspendedIn.length > 1 ? 'estão suspensos' : 'está suspenso'} neste jogo.` : msg);
}
