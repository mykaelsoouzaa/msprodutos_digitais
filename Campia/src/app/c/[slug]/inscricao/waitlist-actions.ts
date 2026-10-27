'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { normalizePhone } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';

/** Entra na lista de espera (o visitante não está logado: grava pelo servidor, com validação). */
export async function joinWaitlist(formData: FormData) {
  const slug = String(formData.get('slug') || '');
  const back = `/c/${slug}/inscricao`;
  const go = (k: 'ok' | 'erro', msg: string): never => redirect(`${back}?${k}=${encodeURIComponent(msg)}`);
  const f = z.object({
    team: z.string().trim().min(2, 'Nome do time muito curto').max(40),
    captain: z.string().trim().max(60).default(''),
    email: z.string().trim().toLowerCase().email('E-mail inválido').max(120),
    phone: z.string().trim().default(''),
    consent: z.literal('on', { errorMap: () => ({ message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade' }) }),
  }).safeParse(Object.fromEntries(formData));
  if (!f.success) go('erro', f.error.issues[0].message);
  const phone = f.data!.phone ? normalizePhone(f.data!.phone) : '';
  if (phone === null) go('erro', 'WhatsApp com DDD inválido');

  const db = createAdminClient();
  const { data: champ } = await db.from('championships').select('id').eq('slug', slug).maybeSingle();
  if (!champ) go('erro', 'Campeonato não encontrado');
  const { error } = await db.from('waitlist').insert({
    championship_id: champ!.id, team_name: f.data!.team, captain_name: f.data!.captain, email: f.data!.email, phone: phone ?? '',
  });
  if (error) go('erro', error.code === '23505' ? 'Esse e-mail já está na lista de espera.' : 'Não foi possível entrar na lista. Tente de novo.');
  const { count } = await db.from('waitlist').select('id', { count: 'exact', head: true }).eq('championship_id', champ!.id).is('notified_at', null);
  go('ok', `Pronto! ${f.data!.team} está na lista de espera (posição ${count ?? 1}). Avisamos por e-mail se abrir vaga.`);
}
