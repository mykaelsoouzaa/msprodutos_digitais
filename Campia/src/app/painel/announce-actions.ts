'use server';
// Recado do organizador para os capitães (e-mail), com limite para não virar spam.
import { redirect } from 'next/navigation';
import { canManage } from '@/lib/access';
import { ANNOUNCE_EVERY_MIN, ANNOUNCE_MAX, announcementEmail, uniqueEmails } from '@/lib/announcement';
import { sendEmail } from '@/lib/email';
import { siteUrl } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function sendAnnouncement(formData: FormData) {
  const champId = String(formData.get('championship') ?? '');
  const back = `/painel/${champId}?aba=compartilhar`;
  const go = (k: 'ok' | 'erro', msg: string): never => redirect(`${back}&${k}=${encodeURIComponent(msg)}#recado`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const { data: c } = await supabase.from('championships').select('id, name, slug, owner_id').eq('id', champId).maybeSingle<{ id: string; name: string; slug: string; owner_id: string }>();
  if (!c || !(await canManage(supabase, c, user))) go('erro', 'Campeonato não encontrado');

  const subject = String(formData.get('subject') ?? '').trim().slice(0, 100);
  const text = String(formData.get('text') ?? '').trim();
  const who = formData.get('who') === 'todos' ? 'todos' : 'inscritos';
  if (subject.length < 3) go('erro', 'Escreva um assunto');
  if (text.length < 5 || text.length > ANNOUNCE_MAX) go('erro', `O recado precisa ter de 5 a ${ANNOUNCE_MAX} caracteres`);

  const admin = createAdminClient();
  const key = `recado:${champId}`;
  const { data: last } = await admin.from('system_status').select('at').eq('key', key).maybeSingle<{ at: string }>();
  if (last && Date.now() - Date.parse(last.at) < ANNOUNCE_EVERY_MIN * 60_000) go('erro', `Espere ${ANNOUNCE_EVERY_MIN} minutos entre um recado e outro`);

  const { data: teams } = await admin.from('teams').select('id, status').eq('championship_id', champId).returns<Array<{ id: string; status: string }>>();
  const ids = (teams ?? []).filter(t => who === 'todos' ? t.status !== 'aberta' : t.status === 'inscrita').map(t => t.id);
  const { data: contacts } = ids.length
    ? await admin.from('team_contacts').select('captain_email').in('team_id', ids).returns<Array<{ captain_email: string }>>()
    : { data: [] as Array<{ captain_email: string }> };
  const to = uniqueEmails((contacts ?? []).map(x => x.captain_email));
  if (!to.length) go('erro', 'Nenhum capitão com e-mail para receber o recado');

  await admin.from('system_status').upsert({ key, at: new Date().toISOString(), info: subject });
  const { data: arena } = await admin.from('arenas').select('name').eq('owner_id', c!.owner_id).maybeSingle<{ name: string }>();
  const mail = announcementEmail({ championship: c!.name, from: arena?.name ?? 'Organização', subject, text, url: `${siteUrl()}/c/${c!.slug}` });
  let sent = 0;
  for (const email of to) {
    if ((await sendEmail({ to: email, subject: mail.subject, html: mail.html, replyTo: user!.email ?? undefined })) === 'ok') sent++;
  }
  if (!sent) go('erro', 'Os e-mails não saíram. Confira o BREVO_API_KEY na Vercel.');
  go('ok', `Recado enviado para ${sent} capitã${sent > 1 ? 'es' : 'o'}`);
}
