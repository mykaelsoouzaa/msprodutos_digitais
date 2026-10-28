// Avisos quando uma inscrição é confirmada: comprovante para o capitão e aviso para o organizador.
// Cada aviso sai uma vez só (o Asaas pode avisar duas vezes o mesmo pagamento).
import { sendEmail } from './email';
import { siteUrl } from './env';
import { logEvent } from './monitor';
import { captainConfirmedEmail, methodLabel, organizerNewTeamEmail } from './payment-emails';
import { createAdminClient } from '@/lib/supabase/admin';

/** Marca a chave como enviada; devolve false se já tinha saído. */
export async function claimOnce(key: string): Promise<boolean> {
  const { error } = await createAdminClient().from('whatsapp_sent').insert({ key: key.slice(0, 120) });
  return !error;
}

export async function notifyPaymentConfirmed(paymentId: string, opts: { manual?: boolean } = {}) {
  try {
    const db = createAdminClient();
    const { data: p } = await db.from('payments').select('id, team_id, championship_id, amount_cents, method, installments, paid_at, status')
      .eq('id', paymentId).maybeSingle<{ id: string; team_id: string; championship_id: string; amount_cents: number; method: string | null; installments: number | null; paid_at: string | null; status: string }>();
    if (!p || p.status !== 'pago') return;
    await notifyTeamConfirmed(p.championship_id, p.team_id, {
      amountCents: p.amount_cents, method: methodLabel(opts.manual ? 'manual' : p.method, p.installments), paidAt: p.paid_at ?? new Date().toISOString(),
      code: p.id.slice(0, 8).toUpperCase(), receiptUrl: `${siteUrl()}/pagamento/${p.id}`, key: p.id,
    });
  } catch (e) {
    await logEvent('email', `Aviso de inscrição confirmada falhou: ${e instanceof Error ? e.message : String(e)}`, { alert: false });
  }
}

/** Também usado para inscrição grátis e para quando o organizador confirma na mão. */
export async function notifyTeamConfirmed(champId: string, teamId: string, i: { amountCents: number; method: string; paidAt: string; code: string; receiptUrl: string | null; key: string }) {
  const db = createAdminClient();
  const [{ data: c }, { data: team }, { data: contact }, { data: teams }] = await Promise.all([
    db.from('championships').select('name, slug, owner_id').eq('id', champId).maybeSingle<{ name: string; slug: string; owner_id: string }>(),
    db.from('teams').select('name').eq('id', teamId).maybeSingle<{ name: string }>(),
    db.from('team_contacts').select('captain_email').eq('team_id', teamId).maybeSingle<{ captain_email: string }>(),
    db.from('teams').select('status').eq('championship_id', champId).returns<Array<{ status: string }>>(),
  ]);
  if (!c || !team) return;
  const champUrl = `${siteUrl()}/c/${c.slug}`;

  if (contact?.captain_email && (await claimOnce(`email:confirmado:${i.key}`))) {
    const m = captainConfirmedEmail({ team: team.name, championship: c.name, amountCents: i.amountCents, method: i.method, paidAt: i.paidAt, code: i.code, receiptUrl: i.receiptUrl ?? champUrl, championshipUrl: champUrl });
    await sendEmail({ to: contact.captain_email, subject: m.subject, html: m.html });
  }

  if (await claimOnce(`email:organizador:${i.key}`)) {
    const { data: owner } = await db.auth.admin.getUserById(c.owner_id);
    const to = owner?.user?.email;
    if (to) {
      const signed = (teams ?? []).filter(t => t.status === 'inscrita').length;
      const m = organizerNewTeamEmail({ team: team.name, championship: c.name, amountCents: i.amountCents, method: i.method, signed, total: (teams ?? []).length, panelUrl: `${siteUrl()}/painel/${champId}?aba=times` });
      await sendEmail({ to, subject: m.subject, html: m.html });
    }
  }
}
