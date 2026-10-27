'use server';
// Patrocinadores do campeonato (cadastrar e remover).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ownerIsPro } from '@/lib/plan-server';
import { SPONSOR_LIMIT, normalizeUrl } from '@/lib/sponsors';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const go = (path: string, k: 'ok' | 'erro', msg: string): never =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(msg)}`);

async function owner(champId: string, back: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const { data: champ } = await supabase.from('championships').select('id, slug').eq('id', champId).eq('owner_id', user!.id).maybeSingle();
  if (!champ) go(back, 'erro', 'Campeonato não encontrado');
  return { supabase, user: user!, champ: champ! };
}

export async function addSponsor(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes#patrocinio`;
  const { supabase, user, champ } = await owner(champId, back);
  if (!(await ownerIsPro(supabase, user.id))) go(back, 'erro', 'Patrocinadores fazem parte do Plano Pro');

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2 || name.length > 60) go(back, 'erro', 'Nome do patrocinador: de 2 a 60 letras');
  const url = normalizeUrl(String(formData.get('url') ?? ''));
  if (url === null) go(back, 'erro', 'Site ou Instagram do patrocinador inválido');
  const tier = formData.get('tier') === 'master' ? 'master' : 'apoio';

  const { count } = await supabase.from('sponsors').select('id', { count: 'exact', head: true }).eq('championship_id', champId);
  if ((count ?? 0) >= SPONSOR_LIMIT) go(back, 'erro', `Limite de ${SPONSOR_LIMIT} patrocinadores por campeonato`);

  let logo_url = '';
  const logo = formData.get('logo');
  if (logo instanceof File && logo.size > 0) {
    const ext = LOGO_TYPES[logo.type];
    if (!ext) go(back, 'erro', 'Logo: envie PNG, JPG ou WEBP');
    if (logo.size > 1024 * 1024) go(back, 'erro', 'Logo: o arquivo pode ter até 1 MB');
    const admin = createAdminClient();
    const path = `${user.id}/patrocinio-${champId.slice(0, 8)}-${Date.now()}.${ext}`;
    const { error } = await admin.storage.from('arenas').upload(path, logo, { contentType: logo.type, upsert: false });
    if (error) go(back, 'erro', 'Não foi possível enviar o logo');
    logo_url = admin.storage.from('arenas').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from('sponsors').insert({ championship_id: champId, name, url: url ?? '', logo_url, tier });
  if (error) go(back, 'erro', 'Não foi possível salvar o patrocinador');
  revalidatePath(`/c/${champ.slug}`);
  go(back, 'ok', `${name} agora aparece como patrocinador`);
}

export async function removeSponsor(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes#patrocinio`;
  const { supabase, champ } = await owner(champId, back);
  await supabase.from('sponsors').delete().eq('id', String(formData.get('sponsor'))).eq('championship_id', champId);
  revalidatePath(`/c/${champ.slug}`);
  go(back, 'ok', 'Patrocinador removido');
}
