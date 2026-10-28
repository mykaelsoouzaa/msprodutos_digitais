'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { paymentProvider } from '@/lib/env';
import { normalizePhone, onlyDigits, parsePlayers, shortName, validCpfCnpj } from '@/lib/format';
import { createCardCharge, createPixCharge } from '@/lib/payments';
import { ownerIsPro } from '@/lib/plan-server';
import { type Coupon, type PriceTier, normalizeCode, todayBr } from '@/lib/pricing';
import { quote } from '@/lib/signup';
import { createAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/monitor';
import { notifyTeamConfirmed } from '@/lib/payment-notify';

const RESERVE_MINUTES = 30;

const Signup = z.object({
  slug: z.string().min(3).max(80),
  name: z.string().trim().min(2, 'Nome do time muito curto').max(40),
  short: z.string().trim().max(3).default(''),
  captain: z.string().trim().min(2, 'Informe o nome do capitão').max(60),
  phone: z.string().transform(s => normalizePhone(s)).refine(Boolean, 'WhatsApp com DDD inválido'),
  email: z.string().trim().toLowerCase().email('E-mail do capitão inválido').max(120),
  cpf: z.string().default(''),
  coupon: z.string().default(''),
  method: z.enum(['pix', 'cartao']).default('pix'),
  installments: z.coerce.number().int().min(1).max(12).default(1),
  players: z.string().max(4000).default(''),
  consent: z.literal('on', { errorMap: () => ({ message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade' }) }),
});

/**
 * Inscrição pública: reserva uma vaga, grava atletas e cria a cobrança PIX.
 * Roda com a service role porque o visitante não está logado; todas as entradas são validadas aqui.
 */
export async function registerTeam(formData: FormData) {
  const slug = String(formData.get('slug') || '');
  const back = `/c/${slug}/inscricao`;
  const fail = (msg: string): never => redirect(`${back}?erro=${encodeURIComponent(msg)}`);

  const parsed = Signup.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const f = parsed.data!;
  const players = parsePlayers(f.players);
  if (players.length < 1) fail('Cadastre pelo menos 1 atleta (um por linha)');
  const needsCpf = paymentProvider() === 'asaas';
  if (needsCpf && !validCpfCnpj(f.cpf)) fail('CPF ou CNPJ inválido (exigido para gerar o PIX)');

  const db = createAdminClient();
  const { data: champ } = await db.from('championships').select('id, name, fee_cents, owner_id, price_tiers, card_installments').eq('slug', f.slug).maybeSingle();
  if (!champ) fail('Campeonato não encontrado');

  const { data: hasResults } = await db.from('games').select('id').eq('championship_id', champ!.id).not('home_score', 'is', null).limit(1);
  if (hasResults?.length) fail('As inscrições estão encerradas: o campeonato já começou');

  // Preço de hoje (lote), cupom, taxa e repasse, validados antes de reservar a vaga.
  const code = normalizeCode(f.coupon);
  const [{ data: coupon }, { count: couponUses }, pro, { data: payout }] = await Promise.all([
    code ? db.from('coupons').select('code, percent, amount_cents, max_uses').eq('championship_id', champ!.id).eq('code', code).maybeSingle<Coupon>() : Promise.resolve({ data: null }),
    code ? db.from('payments').select('id', { count: 'exact', head: true }).eq('championship_id', champ!.id).eq('coupon_code', code).in('status', ['pago', 'pendente']) : Promise.resolve({ count: 0 }),
    ownerIsPro(db, champ!.owner_id),
    db.from('payout_accounts').select('asaas_wallet_id').eq('owner_id', champ!.owner_id).maybeSingle(),
  ]);
  const q = quote({
    baseCents: champ!.fee_cents, tiers: champ!.price_tiers as PriceTier[], today: todayBr(), couponCode: f.coupon,
    coupon: coupon ?? null, couponUses: couponUses ?? 0, pro, walletId: (payout?.asaas_wallet_id as string | undefined) ?? null,
  });
  if (!q.ok) fail(q.error);
  const { amount, discount, fee, split } = q as Extract<typeof q, { ok: true }>;

  const { data: teamId, error: reserveError } = await db.rpc('reserve_slot', {
    p_championship: champ!.id, p_name: f.name, p_short: shortName(f.name, f.short), p_captain: f.captain,
    p_phone: f.phone!, p_minutes: RESERVE_MINUTES,
  });
  if (reserveError) fail('Não foi possível reservar a vaga. Tente de novo.');
  if (!teamId) fail('As vagas esgotaram');

  await db.from('team_contacts').update({ captain_email: f.email }).eq('team_id', teamId);
  // Se o time estava na lista de espera, sai dela.
  await db.from('waitlist').delete().eq('championship_id', champ!.id).eq('email', f.email);
  await db.from('players').insert(players.map(p => ({ championship_id: champ!.id, team_id: teamId, name: p.name, number: p.number })));

  // Inscrição grátis: confirma direto.
  if (amount === 0) {
    // Cupom de 100%: registra o uso para contar no limite do cupom.
    if (code) await db.from('payments').insert({ championship_id: champ!.id, team_id: teamId, amount_cents: 0, provider: 'mock', status: 'pago', paid_at: new Date().toISOString(), coupon_code: code, discount_cents: discount });
    await db.from('teams').update({ status: 'inscrita', paid: true, reserved_until: null }).eq('id', teamId);
    await notifyTeamConfirmed(champ!.id, teamId as string, { amountCents: 0, method: code ? `Cupom ${code}` : 'Inscrição grátis', paidAt: new Date().toISOString(), code: String(teamId).slice(0, 8).toUpperCase(), receiptUrl: null, key: `gratis:${teamId}` });
    redirect(`/c/${f.slug}?ok=${encodeURIComponent(`${f.name} está inscrito!`)}`);
  }

  // Cartão só se o organizador liberou, e no máximo as parcelas que ele escolheu.
  const maxInstallments = Number(champ!.card_installments ?? 0);
  const card = f.method === 'cartao' && maxInstallments > 0;
  const installments = card ? Math.min(f.installments, maxInstallments) : 1;

  const { data: payment, error: payError } = await db.from('payments').insert({
    championship_id: champ!.id, team_id: teamId, amount_cents: amount, provider: paymentProvider(),
    coupon_code: code || null, discount_cents: discount, fee_percent: fee, method: card ? 'cartao' : 'pix', installments: card ? installments : null,
  }).select('id').single();
  if (payError || !payment) fail('Não foi possível criar a cobrança');

  if (card) {
    try {
      const c = await createCardCharge({
        paymentId: payment!.id, amountCents: amount, description: `Inscrição ${f.name} · ${champ!.name}`,
        payerName: f.captain, payerPhone: f.phone!, payerCpfCnpj: needsCpf ? onlyDigits(f.cpf) : undefined, split, installments,
      });
      await db.from('payments').update({
        payout: c.splitApplied ? 'automatico' : 'manual',
        split_wallet_id: c.splitApplied ? split!.walletId : null, split_percent: c.splitApplied ? split!.percent : null,
        provider_id: c.providerId, invoice_url: c.invoiceUrl, provider_installment_id: c.installmentId,
        expires_at: new Date(Date.now() + RESERVE_MINUTES * 60_000).toISOString(),
      }).eq('id', payment!.id);
      if (split && !c.splitApplied) await logEvent('repasse', `Asaas recusou o split no cartão para a carteira ${split.walletId} (${champ!.name})`);
    } catch (e) {
      await db.from('payments').update({ status: 'cancelado' }).eq('id', payment!.id);
      await db.from('teams').update({ reserved_until: new Date(0).toISOString() }).eq('id', teamId);
      await logEvent('pix', `Cartão · ${champ!.name}: ${e instanceof Error ? e.message : String(e)}`);
      fail(e instanceof Error ? `Cartão: ${e.message}` : 'Falha ao gerar a cobrança no cartão');
    }
    redirect(`/pagamento/${payment!.id}`);
  }

  try {
    const charge = await createPixCharge({
      paymentId: payment!.id, amountCents: amount, description: `Inscrição ${f.name} · ${champ!.name}`,
      payerName: f.captain, payerPhone: f.phone!, payerCpfCnpj: needsCpf ? onlyDigits(f.cpf) : undefined, split,
    });
    await db.from('payments').update({
      payout: charge.splitApplied ? 'automatico' : 'manual',
      split_wallet_id: charge.splitApplied ? split!.walletId : null, split_percent: charge.splitApplied ? split!.percent : null,
      provider_id: charge.providerId, pix_payload: charge.payload, pix_image: charge.imageBase64,
      expires_at: new Date(Date.now() + RESERVE_MINUTES * 60_000).toISOString(),
    }).eq('id', payment!.id);
    if (split && !charge.splitApplied) await logEvent('repasse', `Asaas recusou o split para a carteira ${split.walletId} (${champ!.name}); cobrança saiu sem repasse automático`);
  } catch (e) {
    await db.from('payments').update({ status: 'cancelado' }).eq('id', payment!.id);
    await db.from('teams').update({ reserved_until: new Date(0).toISOString() }).eq('id', teamId); // libera a vaga
    await logEvent('pix', `${champ!.name}: ${e instanceof Error ? e.message : String(e)}`);
    fail(e instanceof Error ? `PIX: ${e.message}` : 'Falha ao gerar o PIX');
  }

  redirect(`/pagamento/${payment!.id}`);
}
