'use server';
// Perfil do atleta: "Sou eu", aprovação pelo capitão/organizador e edição do perfil.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { HANDLE_RE, handleFrom } from '@/lib/athlete';
import { escapeHtml, sendEmail } from '@/lib/email';
import { siteUrl } from '@/lib/env';
import { UFS, slugify } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const go = (path: string, k: 'ok' | 'erro', msg: string): never => {
  const [base, hash] = path.split('#');
  redirect(`${base}${base.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ''}`);
};
/** Só caminhos internos (evita redirecionar para outro site). */
const safeBack = (v: FormDataEntryValue | null, fallback: string) => {
  const s = String(v ?? '');
  return s.startsWith('/') && !s.startsWith('//') ? s : fallback;
};

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Cria o perfil com um endereço livre, se a pessoa ainda não tem. */
async function ensureAthlete(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, name: string) {
  const { data: me } = await supabase.from('athletes').select('handle').eq('user_id', userId).maybeSingle();
  if (me) return me.handle as string;
  for (let i = 0; i < 4; i++) {
    const handle = handleFrom(name, i ? Math.random().toString(36).slice(2, 6) : '');
    const { error } = await supabase.from('athletes').insert({ user_id: userId, handle, name: name.slice(0, 60) });
    if (!error) return handle;
    if (error.code !== '23505') break;
  }
  return null;
}

export async function claimPlayer(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  const back = `/c/${slug}?aba=times`;
  const { supabase, user } = await session();
  if (!user) redirect(`/entrar?voltar=${encodeURIComponent(back)}`);

  const playerId = String(formData.get('player') ?? '');
  const { data: p } = await supabase.from('players').select('id, name, team_id, championship_id, teams(name)').eq('id', playerId)
    .maybeSingle<{ id: string; name: string; team_id: string; championship_id: string; teams: { name: string } | null }>();
  if (!p) go(back, 'erro', 'Atleta não encontrado');
  const { data: mine } = await supabase.from('player_claims').select('player_id').eq('championship_id', p!.championship_id).eq('user_id', user!.id).maybeSingle();
  if (mine) go(back, 'erro', 'Você já está ligado a um atleta deste campeonato');

  const handle = await ensureAthlete(supabase, user!.id, p!.name);
  if (!handle) go(back, 'erro', 'Não foi possível criar seu perfil de atleta');

  // Capitão do próprio time ou organizador: já entra aprovado.
  const admin = createAdminClient();
  const [{ data: contact }, { data: champ }] = await Promise.all([
    admin.from('team_contacts').select('captain_email').eq('team_id', p!.team_id).maybeSingle<{ captain_email: string }>(),
    admin.from('championships').select('owner_id, name').eq('id', p!.championship_id).maybeSingle<{ owner_id: string; name: string }>(),
  ]);
  const email = (user!.email ?? '').toLowerCase();
  const trusted = (!!contact?.captain_email && contact.captain_email === email) || champ?.owner_id === user!.id;

  const { error } = await supabase.from('player_claims').insert({
    player_id: p!.id, championship_id: p!.championship_id, team_id: p!.team_id, user_id: user!.id, status: trusted ? 'aprovado' : 'pendente',
  });
  if (error) go(back, 'erro', error.code === '23505' ? 'Esse atleta já foi reivindicado por outra pessoa' : 'Não foi possível enviar o pedido');

  if (!trusted && contact?.captain_email) {
    await sendEmail({
      to: contact.captain_email,
      subject: `${p!.name} quer ligar o perfil de atleta`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<p>Alguém entrou na Campia com o e-mail <b>${escapeHtml(email)}</b> e disse ser <b>${escapeHtml(p!.name)}</b>, do <b>${escapeHtml(p!.teams?.name ?? 'seu time')}</b>, no ${escapeHtml(champ?.name ?? 'campeonato')}.</p>
<p>Se for mesmo, aprove para os gols e títulos irem para o perfil dele.</p>
<p><a href="${siteUrl()}/meus-times" style="display:inline-block;background:#22c55e;color:#06210f;padding:12px 20px;border-radius:10px;font-weight:bold;text-decoration:none">Ver o pedido</a></p>
</div>`,
    });
  }
  revalidatePath(`/atleta/${handle}`);
  go(back, 'ok', trusted ? 'Pronto! Esse atleta agora está no seu perfil.' : 'Pedido enviado. Assim que o capitão aprovar, aparece no seu perfil.');
}

export async function decideClaim(formData: FormData) {
  const back = safeBack(formData.get('back'), '/meus-times');
  const { supabase, user } = await session();
  if (!user) redirect('/entrar');
  const playerId = String(formData.get('player') ?? '');
  const approve = formData.get('decision') === 'aprovar';
  const { data, error } = approve
    ? await supabase.from('player_claims').update({ status: 'aprovado' }).eq('player_id', playerId).select('user_id')
    : await supabase.from('player_claims').delete().eq('player_id', playerId).select('user_id');
  if (error || !data?.length) go(back, 'erro', 'Você não pode decidir esse pedido');
  const { data: a } = await supabase.from('athletes').select('handle').eq('user_id', data![0].user_id).maybeSingle();
  if (a) revalidatePath(`/atleta/${a.handle}`);
  go(back, 'ok', approve ? 'Atleta ligado ao perfil' : 'Pedido recusado');
}

export async function leaveClaim(formData: FormData) {
  const { supabase, user } = await session();
  if (!user) redirect('/entrar');
  await supabase.from('player_claims').delete().eq('player_id', String(formData.get('player') ?? '')).eq('user_id', user!.id);
  go('/atleta', 'ok', 'Atleta removido do seu perfil');
}

const Profile = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(60),
  handle: z.string().trim().toLowerCase().transform(s => slugify(s).slice(0, 40)).refine(s => HANDLE_RE.test(s), 'Endereço: de 3 a 40 letras, números ou hífens'),
  city: z.string().trim().max(60).default(''),
  state: z.union([z.enum(UFS), z.literal('')]).default(''),
  bio: z.string().trim().max(200).default(''),
});

export async function saveAthlete(formData: FormData) {
  const { supabase, user } = await session();
  if (!user) redirect('/entrar?voltar=/atleta');
  const parsed = Profile.safeParse(Object.fromEntries(formData));
  if (!parsed.success) go('/atleta', 'erro', parsed.error.issues[0].message);
  const f = parsed.data!;
  const { data: me } = await supabase.from('athletes').select('handle').eq('user_id', user!.id).maybeSingle();
  const { error } = me
    ? await supabase.from('athletes').update(f).eq('user_id', user!.id)
    : await supabase.from('athletes').insert({ ...f, user_id: user!.id });
  if (error) go('/atleta', 'erro', error.code === '23505' ? 'Esse endereço já está em uso. Escolha outro.' : 'Não foi possível salvar');
  if (me) revalidatePath(`/atleta/${me.handle}`);
  revalidatePath(`/atleta/${f.handle}`);
  go('/atleta', 'ok', 'Perfil salvo');
}
