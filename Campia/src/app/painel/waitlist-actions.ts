'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** O dono remove alguém da lista de espera (o RLS só permite ao dono). */
export async function removeFromWaitlist(formData: FormData) {
  const champId = String(formData.get('championship'));
  const supabase = await createClient();
  await supabase.from('waitlist').delete().eq('id', String(formData.get('entry'))).eq('championship_id', champId);
  revalidatePath(`/painel/${champId}`);
  redirect(`/painel/${champId}?aba=times&ok=${encodeURIComponent('Removido da lista de espera')}`);
}
