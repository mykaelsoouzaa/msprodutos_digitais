// Indicação: guardar quem indicou, criar o código e dar o mês de Pro de presente.
import { cookies } from 'next/headers';
import { escapeHtml, sendEmail } from './email';
import { siteUrl } from './env';
import { logEvent } from './monitor';
import { REFERRAL_COOKIE, REFERRAL_RE, addMonth, newReferralCode } from './referral';
import { createAdminClient } from '@/lib/supabase/admin';

/** Código de indicação do organizador (cria na primeira vez). */
export async function ensureReferralCode(ownerId: string): Promise<string | null> {
  try {
    const db = createAdminClient();
    const { data } = await db.from('referral_codes').select('code').eq('owner_id', ownerId).maybeSingle<{ code: string }>();
    if (data) return data.code;
    for (let i = 0; i < 4; i++) {
      const code = newReferralCode();
      const { error } = await db.from('referral_codes').insert({ owner_id: ownerId, code });
      if (!error) return code;
    }
  } catch { /* banco sem a tabela ainda */ }
  return null;
}

/**
 * Se a pessoa chegou por um link de indicação (cookie) e ainda não foi indicada, registra quem indicou.
 * Chamado quando o organizador cria o primeiro campeonato ou assina o Pro.
 */
export async function attributeReferral(userId: string) {
  try {
    const code = (await cookies()).get(REFERRAL_COOKIE)?.value ?? '';
    if (!REFERRAL_RE.test(code)) return;
    const db = createAdminClient();
    const { data: ref } = await db.from('referral_codes').select('owner_id').eq('code', code).maybeSingle<{ owner_id: string }>();
    if (!ref || ref.owner_id === userId) return;
    await db.from('referrals').insert({ referred_id: userId, referrer_id: ref.owner_id }); // já indicado: a chave primária barra
  } catch { /* nunca atrapalha o fluxo principal */ }
}

/** Primeira mensalidade paga pela arena indicada: quem indicou ganha 1 mês de Pro (uma vez só). */
export async function rewardReferrer(referredId: string) {
  try {
    const db = createAdminClient();
    const { data: claimed } = await db.from('referrals').update({ rewarded_at: new Date().toISOString() })
      .eq('referred_id', referredId).is('rewarded_at', null).select('referrer_id');
    const referrer = claimed?.[0]?.referrer_id as string | undefined;
    if (!referrer) return;
    const { data: plan } = await db.from('plans').select('paid_until, source, status').eq('owner_id', referrer).maybeSingle<{ paid_until: string | null; source: string; status: string }>();
    const paidUntil = addMonth(plan?.paid_until ?? null);
    const { error } = plan
      ? await db.from('plans').update({ paid_until: paidUntil, updated_at: new Date().toISOString(), ...(plan.status === 'pendente' ? {} : { status: plan.status === 'cancelado' && plan.source === 'asaas' ? 'cancelado' : 'ativo' }) }).eq('owner_id', referrer)
      : await db.from('plans').insert({ owner_id: referrer, source: 'cortesia', status: 'ativo', paid_until: paidUntil });
    if (error) { await logEvent('indicacao', `Prêmio de indicação não aplicado para ${referrer}: ${error.message}`); return; }
    const { data: u } = await db.auth.admin.getUserById(referrer);
    if (u?.user?.email) {
      await sendEmail({
        to: u.user.email, subject: 'Você ganhou 1 mês de Campia Pro',
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
<h2 style="margin:0 0 8px">Valeu pela indicação! 🎉</h2>
<p>Uma arena que você indicou assinou o Campia Pro. Como prometido, você ganhou <b>1 mês de Pro</b>: válido até <b>${escapeHtml(new Date(paidUntil).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}</b>.</p>
<p><a href="${siteUrl()}/painel/plano" style="display:inline-block;background:#22c55e;color:#06210f;padding:12px 20px;border-radius:10px;font-weight:bold;text-decoration:none">Ver meu plano</a></p>
</div>`,
      });
    }
  } catch (e) {
    await logEvent('indicacao', `Prêmio de indicação falhou: ${e instanceof Error ? e.message : String(e)}`);
  }
}
