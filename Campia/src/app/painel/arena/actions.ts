'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ARENA_SLUG_RE } from '@/lib/arena';
import { UFS, normalizePhone, slugify } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const fail = (msg: string): never => redirect(`/painel/arena?erro=${encodeURIComponent(msg)}`);

const Arena = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(80),
  slug: z.string().trim().toLowerCase().default(''),
  bio: z.string().trim().max(400, 'A descrição pode ter até 400 caracteres').default(''),
  address: z.string().trim().max(120).default(''),
  city: z.string().trim().max(60).default(''),
  state: z.union([z.enum(UFS), z.literal('')]).default(''),
  whatsapp: z.string().trim().default(''),
  instagram: z.string().trim().default('')
    .transform(s => s.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/^@/, '').replace(/[/?].*$/, '')),
});

const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function saveArena(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?voltar=/painel/arena');

  const parsed = Arena.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')));
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const f = parsed.data!;
  const slug = slugify(f.slug || f.name);
  if (!ARENA_SLUG_RE.test(slug)) fail('Endereço da página: use de 3 a 60 letras, números ou hífens');
  const whatsapp = f.whatsapp ? normalizePhone(f.whatsapp) : '';
  if (whatsapp === null) fail('WhatsApp inválido: use DDD + número');
  if (!/^[A-Za-z0-9._]{0,30}$/.test(f.instagram)) fail('Instagram inválido: use só o @usuário');

  const { data: current } = await supabase.from('arenas').select('id, logo_url').eq('owner_id', user!.id).maybeSingle();
  let logo_url: string = current?.logo_url ?? '';

  const logo = formData.get('logo');
  if (logo instanceof File && logo.size > 0) {
    const ext = LOGO_TYPES[logo.type];
    if (!ext) fail('Logo: envie PNG, JPG ou WEBP');
    if (logo.size > 1024 * 1024) fail('Logo: o arquivo pode ter até 1 MB');
    const admin = createAdminClient();
    const path = `${user!.id}/logo-${Date.now()}.${ext}`;
    const { error } = await admin.storage.from('arenas').upload(path, logo, { contentType: logo.type, upsert: true });
    if (error) fail('Não foi possível enviar o logo');
    logo_url = admin.storage.from('arenas').getPublicUrl(path).data.publicUrl;
  }
  if (formData.get('removeLogo') === '1') logo_url = '';

  const row = { name: f.name, slug, bio: f.bio, address: f.address, city: f.city, state: f.state, whatsapp: whatsapp ?? '', instagram: f.instagram, logo_url };
  const { error } = current
    ? await supabase.from('arenas').update(row).eq('id', current.id)
    : await supabase.from('arenas').insert({ ...row, owner_id: user!.id });
  if (error) fail(error.code === '23505' ? 'Esse endereço de página já está em uso. Escolha outro.' : 'Não foi possível salvar');

  revalidatePath(`/arena/${slug}`);
  redirect(`/painel/arena?ok=${encodeURIComponent('Página da arena salva')}`);
}
