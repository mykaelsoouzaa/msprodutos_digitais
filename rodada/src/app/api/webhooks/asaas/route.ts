import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { PAID_EVENTS } from '@/lib/payments/asaas';
import { createAdminClient } from '@/lib/supabase/admin';

// Webhook da Asaas: confirma o pagamento e a vaga.
// A Asaas envia o token configurado no cabeçalho `asaas-access-token` e pode repetir o mesmo evento,
// por isso guardamos o id do evento e ignoramos repetições.
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: NextRequest) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const got = request.headers.get('asaas-access-token') || '';
  if (!expected || !safeEqual(got, expected)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as
    | { id?: string; event?: string; payment?: { id?: string; externalReference?: string } }
    | null;
  if (!body?.event || !body.payment?.id) return NextResponse.json({ ok: true });

  const db = createAdminClient();
  if (body.id) {
    const { data: seen } = await db.from('webhook_events').select('id').eq('id', body.id).maybeSingle();
    if (seen) return NextResponse.json({ ok: true, duplicate: true });
  }

  if (PAID_EVENTS.has(body.event)) {
    // Confere que o pagamento é nosso pelos dois lados: id da Asaas e externalReference.
    const { data: p } = await db.from('payments').select('id').eq('provider', 'asaas').eq('provider_id', body.payment.id).maybeSingle();
    if (p && p.id === body.payment.externalReference) {
      const { error } = await db.rpc('confirm_payment', { p_payment: p.id });
      // Erro: responde 500 para a Asaas reenviar (confirm_payment é idempotente).
      if (error) return NextResponse.json({ error: 'retry' }, { status: 500 });
    }
  }
  // Só registra o evento depois de processado, para que uma falha no meio seja reenviada.
  if (body.id) await db.from('webhook_events').insert({ id: body.id, provider: 'asaas' });
  return NextResponse.json({ ok: true });
}
