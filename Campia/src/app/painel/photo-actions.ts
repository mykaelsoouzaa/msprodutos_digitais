'use server';
// Fotos do campeonato: o organizador (ou ajudante) sobe e remove.
import { revalidatePath } from 'next/cache';
import { roleIn } from '@/lib/access';
import { PHOTO_LIMIT, PHOTO_MAX_BYTES, PHOTO_TYPES, type Photo } from '@/lib/photos';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

async function load(champId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: c } = await supabase.from('championships').select('id, slug, owner_id, rules').eq('id', champId)
    .maybeSingle<{ id: string; slug: string; owner_id: string; rules: Record<string, unknown> & { photos?: Photo[] } }>();
  if (!c || !(await roleIn(supabase, c, user))) return null;
  return c;
}

/** Uma foto por chamada (o celular já manda reduzida). */
export async function addPhoto(formData: FormData): Promise<Result> {
  const c = await load(String(formData.get('championship') ?? ''));
  if (!c) return { ok: false, error: 'Sem acesso a este campeonato' };
  const file = formData.get('photo');
  if (!(file instanceof File) || !file.size) return { ok: false, error: 'Escolha uma foto' };
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return { ok: false, error: 'Envie foto em JPG, PNG ou WEBP' };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: 'Foto grande demais (até 1 MB depois de reduzida)' };
  const admin = createAdminClient();
  // Lê de novo na hora de gravar: outras fotos podem ter chegado enquanto esta subia.
  const { data: fresh } = await admin.from('championships').select('rules').eq('id', c.id).maybeSingle<{ rules: Record<string, unknown> & { photos?: Photo[] } }>();
  const photos = fresh?.rules?.photos ?? [];
  if (photos.length >= PHOTO_LIMIT) return { ok: false, error: `Limite de ${PHOTO_LIMIT} fotos por campeonato` };
  const path = `${c.owner_id}/fotos/${c.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await admin.storage.from('arenas').upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: 'Não foi possível enviar a foto' };
  const url = admin.storage.from('arenas').getPublicUrl(path).data.publicUrl;
  const caption = String(formData.get('caption') ?? '').trim().slice(0, 120);
  await admin.from('championships').update({ rules: { ...(fresh?.rules ?? {}), photos: [...photos, { url, path, caption, at: new Date().toISOString() }] } }).eq('id', c.id);
  revalidatePath(`/c/${c.slug}`);
  revalidatePath(`/painel/${c.id}`);
  return { ok: true };
}

export async function removePhoto(formData: FormData) {
  const c = await load(String(formData.get('championship') ?? ''));
  if (!c) return;
  const path = String(formData.get('path') ?? '');
  const admin = createAdminClient();
  const { data: fresh } = await admin.from('championships').select('rules').eq('id', c.id).maybeSingle<{ rules: Record<string, unknown> & { photos?: Photo[] } }>();
  const photos = (fresh?.rules?.photos ?? []).filter(p => p.path !== path);
  await admin.from('championships').update({ rules: { ...(fresh?.rules ?? {}), photos } }).eq('id', c.id);
  if (path.startsWith(`${c.owner_id}/fotos/${c.id}/`)) await admin.storage.from('arenas').remove([path]);
  revalidatePath(`/c/${c.slug}`);
  revalidatePath(`/painel/${c.id}`);
}
