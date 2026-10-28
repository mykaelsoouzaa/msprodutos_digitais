'use server';
// Árbitro e lances (links de vídeo) de um jogo. Dono ou ajudante; guardado em rules.gameInfo.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { roleIn } from '@/lib/access';
import { cleanVideos } from '@/lib/game-info';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Rules } from '@/lib/domain/types';

export async function updateGameInfo(formData: FormData) {
  const champId = String(formData.get('championship'));
  const gameId = String(formData.get('game'));
  const back = `/painel/${champId}/jogo/${gameId}`;
  const fail = (m: string) => redirect(`${back}?erro=${encodeURIComponent(m)}#sumula`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const { data: c } = await supabase.from('championships').select('id, owner_id, slug').eq('id', champId).maybeSingle();
  if (!c || !(await roleIn(supabase, c, user))) fail('Você não tem acesso a este campeonato');
  const { data: g } = await supabase.from('games').select('id').eq('id', gameId).eq('championship_id', champId).maybeSingle();
  if (!g) fail('Jogo não encontrado');

  const referee = String(formData.get('referee') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const videos = cleanVideos(String(formData.get('videos') ?? ''));
  // Ajudante não tem permissão de alterar o campeonato pelo banco: grava com a chave do servidor depois da checagem acima.
  const admin = createAdminClient();
  const { data: row } = await admin.from('championships').select('rules').eq('id', champId).single<{ rules: Rules }>();
  const map = { ...(row?.rules.gameInfo ?? {}) };
  if (referee || videos.length) map[gameId] = { ...(referee ? { referee } : {}), ...(videos.length ? { videos } : {}) };
  else delete map[gameId];
  const { error } = await admin.from('championships').update({ rules: { ...row?.rules, gameInfo: map } }).eq('id', champId);
  if (error) fail('Não foi possível salvar');
  revalidatePath(`/c/${c!.slug}`);
  revalidatePath(`/c/${c!.slug}/jogo/${gameId}`);
  redirect(`${back}?ok=${encodeURIComponent('Árbitro e lances salvos')}#sumula`);
}
