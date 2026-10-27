import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { extendPaidUntil } from '@/lib/plan';
import { webhookAction } from '@/lib/signup';
import { createAdminClient } from '@/lib/supabase/admin';
import { beat, logEvent } from '@/lib/monitor';

// Webhook da Asaas: confirma o pagamento e a vaga.
// A Asaas envia o token configurado no cabeçalho `asaas-access-token` e pode repetir o mesmo evento,
// por isso guardamos o id do evento e ignoramos repetições.
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: NextRequest) {
  // trim(): espaço ou quebra de linha colados junto com o token não podem derrubar o webhook.
  const expected = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
  const got = (request.headers.get('asaas-access-token') || '').trim();
  if (!expected || !safeEqual(got, expected)) {
    // Diagnóstico sem revelar o token: aparece no log de webhooks do Asaas e nos logs da Vercel.
    const motivo = !expected ? 'ASAAS_WEBHOOK_TOKEN não configurado na Vercel'
      : !got ? 'o Asaas não enviou token (webhook sem token de autenticação)'
      : 'token diferente do ASAAS_WEBHOOK_TOKEN da Vercel';
    await logEvent('webhook', `Recusado (401): ${motivo}`);
    return NextResponse.json({ error: 'unauthorized', motivo, recebido: got.length, esperado: expected.length }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as
    | { id?: string; event?: string; payment?: { id?: string; externalReference?: string; subscription?: string; dueDate?: string } }
    | null;
  if (!body?.event || !body.payment?.id) return NextResponse.json({ ok: true });
  await beat('webhook', body.event);

  const db = createAdminClient();
  if (body.id) {
    const { data: seen } = await db.from('webhook_events').select('id').eq('id', body.id).maybeSingle();
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
  }

  const action = webhookAction(body, new Date().toISOString().slice(0, 10));
  if (action.type === 'plano') {
    // Mensalidade do Plano Pro: estende a validade a partir do vencimento dessa cobrança.
    const { data: plan } = await db.from('plans').select('owner_id, paid_until').eq('asaas_subscription_id', action.subscription).maybeSingle();
    if (plan) {
      const { error } = await db.from('plans').update({ status: 'ativo', paid_until: extendPaidUntil(plan.paid_until, action.dueDate), updated_at: new Date().toISOString() })
        .eq('owner_id', plan.owner_id);
      if (error) { await logEvent('webhook', `Mensalidade do Pro não registrada: ${error.message}`); return NextResponse.json({ error: 'retry' }, { status: 500 }); }
    }
  } else if (action.type === 'inscricao') {
    // Confere que o pagamento é nosso pelos dois lados: id da Asaas e externalReference.
    const { data: p } = await db.from('payments').select('id').eq('provider', 'asaas').eq('provider_id', action.asaasId).maybeSingle();
    if (p && p.id === action.reference) {
      const { error } = await db.rpc('confirm_payment', { p_payment: p.id });
      // Erro: responde 500 para a Asaas reenviar (confirm_payment é idempotente).
      if (error) { await logEvent('webhook', `Pagamento ${p.id} não confirmado: ${error.message}`); return NextResponse.json({ error: 'retry' }, { status: 500 }); }
    }
  }
  // Só registra o evento depois de processado, para que uma falha no meio seja reenviada.
  if (body.id) await db.from('webhook_events').insert({ id: body.id, provider: 'asaas' });
  return NextResponse.json({ ok: true });
}
