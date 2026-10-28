// Aviso no celular de quem segue um time quando sai o resultado do jogo dele.
import { claimOnce } from './payment-notify';
import { logEvent } from './monitor';
import { sendPush } from './push';
import type { Game, Team } from './domain/types';
import { resultText } from './game-info';
import { createAdminClient } from '@/lib/supabase/admin';

/** Sai uma vez por jogo (corrigir o placar depois não manda de novo). Nunca derruba o salvamento. */
export async function notifyResult(champ: { id: string; name: string; slug: string }, g: Game, teams: Team[]) {
  try {
    if (!process.env.VAPID_PRIVATE_KEY || !g.homeId || !g.awayId) return;
    const db = createAdminClient();
    const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, team_id')
      .eq('championship_id', champ.id).in('team_id', [g.homeId, g.awayId])
      .returns<Array<{ id: string; endpoint: string; p256dh: string; auth: string; team_id: string }>>();
    if (!subs?.length || !(await claimOnce(`push:resultado:${g.id}`))) return;
    const name = (id: string | null) => teams.find(t => t.id === id)?.name ?? '?';
    const body = resultText(g, name(g.homeId), name(g.awayId));
    await Promise.all(subs.map(async s => {
      const r = await sendPush(s, { title: `🏁 Fim de jogo · ${champ.name}`, body, url: `/c/${champ.slug}/jogo/${g.id}`, tag: `resultado-${g.id}` });
      if (r === 'gone') await db.from('push_subscriptions').delete().eq('id', s.id);
    }));
  } catch (e) {
    await logEvent('push', `Aviso de resultado falhou: ${e instanceof Error ? e.message : String(e)}`, { alert: false });
  }
}
