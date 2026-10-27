'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { categoriesFor } from '@/lib/voting';
import { createClient } from '@/lib/supabase/server';

/** Registra (ou troca) o voto de quem está logado. O banco garante 1 voto por pessoa e categoria. */
export async function castVote(formData: FormData) {
  const slug = String(formData.get('slug'));
  const back = `/c/${slug}?aba=votacao`;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?voltar=${encodeURIComponent(back)}`);
  const { data: c } = await supabase.from('championships').select('id, sport, voting').eq('slug', slug).maybeSingle();
  if (!c || c.voting !== 'aberta') redirect(`${back}&erro=${encodeURIComponent('A votação não está aberta')}`);

  let n = 0;
  for (const [cat] of categoriesFor(c!.sport)) {
    const player = String(formData.get(`vote_${cat}`) || '');
    if (!player) continue;
    const { error } = await supabase.from('votes').upsert(
      { championship_id: c!.id, category: cat, player_id: player, voter_id: user!.id },
      { onConflict: 'championship_id,category,voter_id' },
    );
    if (!error) n++;
  }
  revalidatePath(`/c/${slug}`);
  redirect(`${back}&ok=${encodeURIComponent(n ? 'Voto registrado! Dá para mudar até a votação encerrar.' : 'Escolha pelo menos um atleta')}`);
}
