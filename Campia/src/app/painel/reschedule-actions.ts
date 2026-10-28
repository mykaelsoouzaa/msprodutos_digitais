'use server';
// Adiar (ou adiantar) todos os jogos sem resultado de uma rodada. Dono ou ajudante.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { roleIn } from '@/lib/access';
import { shiftDate, validShift } from '@/lib/reschedule';
import { createClient } from '@/lib/supabase/server';

export async function shiftRound(formData: FormData) {
  const champId = String(formData.get('championship'));
  const label = String(formData.get('label') ?? '').slice(0, 60);
  const days = Number(formData.get('days'));
  const back = `/painel/${champId}?aba=jogos`;
  const go = (k: 'ok' | 'erro', m: string): never => redirect(`${back}&${k}=${encodeURIComponent(m)}`);
  if (!validShift(days)) go('erro', 'Escolha de 1 a 90 dias');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const { data: c } = await supabase.from('championships').select('id, owner_id, slug').eq('id', champId).maybeSingle();
  if (!c || !(await roleIn(supabase, c, user))) go('erro', 'Você não tem acesso a este campeonato');
  const { data: rows } = await supabase.from('games').select('id, date').eq('championship_id', champId).eq('label', label)
    .is('home_score', null).is('wo', null).not('date', 'is', null).returns<Array<{ id: string; date: string }>>();
  if (!rows?.length) go('erro', 'Essa rodada não tem jogos marcados sem resultado');
  const results = await Promise.all(rows!.map(r => supabase.from('games').update({ date: shiftDate(r.date, days) }).eq('id', r.id)));
  if (results.some(r => r.error)) go('erro', 'Alguns jogos não foram remarcados; confira a lista');
  revalidatePath(`/painel/${champId}`);
  revalidatePath(`/c/${c!.slug}`);
  go('ok', `${label}: ${rows!.length} jogo${rows!.length === 1 ? '' : 's'} ${days > 0 ? 'adiado' : 'adiantado'}${rows!.length === 1 ? '' : 's'} em ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`);
}
