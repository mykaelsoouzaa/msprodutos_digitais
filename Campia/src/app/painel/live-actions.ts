'use server';
// Placar ao vivo: dono ou ajudante atualiza durante o jogo.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { roleIn } from '@/lib/access';
import { createClient } from '@/lib/supabase/server';

async function load(formData: FormData) {
  const champId = String(formData.get('championship'));
  const gameId = String(formData.get('game'));
  const back = `/painel/${champId}/jogo/${gameId}`;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const { data: c } = await supabase.from('championships').select('id, owner_id, slug').eq('id', champId).maybeSingle();
  if (!c || !(await roleIn(supabase, c, user))) redirect(`${back}?erro=${encodeURIComponent('Você não tem acesso a este campeonato')}`);
  const { data: g } = await supabase.from('games').select('id, live, live_home, live_away, home_team_id, away_team_id, home_score')
    .eq('id', gameId).eq('championship_id', champId).maybeSingle();
  if (!g || !g.home_team_id || !g.away_team_id) redirect(`${back}?erro=${encodeURIComponent('Jogo sem os dois times definidos')}`);
  return { supabase, champId, gameId, back, slug: c!.slug as string, g: g! };
}

const done = (back: string, slug: string, champId: string) => {
  revalidatePath(`/c/${slug}`);
  revalidatePath(`/painel/${champId}`);
  redirect(`${back}#ao-vivo`);
};

export async function startLive(formData: FormData) {
  const { supabase, gameId, back, slug, champId, g } = await load(formData);
  if (g.home_score !== null) redirect(`${back}?erro=${encodeURIComponent('Esse jogo já tem resultado. Apague o resultado para recomeçar ao vivo.')}`);
  await supabase.from('games').update({ live: true, live_home: 0, live_away: 0, live_started_at: new Date().toISOString() }).eq('id', gameId);
  done(back, slug, champId);
}

/** side = home|away, delta = 1|-1 */
export async function scoreLive(formData: FormData) {
  const { supabase, gameId, back, slug, champId, g } = await load(formData);
  if (!g.live) redirect(back);
  const side = formData.get('side') === 'away' ? 'live_away' : 'live_home';
  const delta = formData.get('delta') === '-1' ? -1 : 1;
  const current = side === 'live_home' ? g.live_home : g.live_away;
  await supabase.from('games').update({ [side]: Math.max(0, (current ?? 0) + delta) }).eq('id', gameId);
  done(back, slug, champId);
}

export async function stopLive(formData: FormData) {
  const { supabase, gameId, back, slug, champId } = await load(formData);
  await supabase.from('games').update({ live: false }).eq('id', gameId);
  done(back, slug, champId);
}
