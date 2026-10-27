'use server';
// Lista "procuro time" do campeonato.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { normalizePhone } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const Entry = z.object({
  slug: z.string().min(3).max(80),
  name: z.string().trim().min(2, 'Nome muito curto').max(60),
  position: z.string().trim().max(40).default(''),
  phone: z.string().transform(s => normalizePhone(s)).refine(Boolean, 'WhatsApp com DDD inválido'),
  note: z.string().trim().max(200).default(''),
});

const back = (slug: string, k: 'ok' | 'erro', msg: string): never =>
  redirect(`/c/${slug}?aba=times&${k}=${encodeURIComponent(msg)}#avulsos`);

export async function joinFreeAgents(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/entrar?voltar=${encodeURIComponent(`/c/${slug}?aba=times`)}`);
  const parsed = Entry.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(slug, 'erro', parsed.error.issues[0].message);
  const f = parsed.data!;
  const { data: champ } = await supabase.from('championships').select('id').eq('slug', f.slug).maybeSingle();
  if (!champ) back(slug, 'erro', 'Campeonato não encontrado');
  const { error } = await supabase.from('free_agents').upsert(
    { championship_id: champ!.id, user_id: user!.id, name: f.name, position: f.position, phone: f.phone!, note: f.note },
    { onConflict: 'championship_id,user_id' },
  );
  if (error) back(slug, 'erro', 'Não foi possível entrar na lista');
  revalidatePath(`/c/${slug}`);
  back(slug, 'ok', 'Você está na lista. Os capitães podem te chamar no WhatsApp.');
}

export async function leaveFreeAgents(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  await supabase.from('free_agents').delete().eq('id', String(formData.get('id') ?? ''));
  revalidatePath(`/c/${slug}`);
  back(slug, 'ok', 'Removido da lista');
}
