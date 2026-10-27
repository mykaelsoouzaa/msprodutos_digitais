'use server';
// Assinatura do Plano Pro.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { paymentProvider } from '@/lib/env';
import { onlyDigits, validCpfCnpj } from '@/lib/format';
import { cancelAsaasSubscription, createAsaasSubscription } from '@/lib/payments/asaas';
import { extendPaidUntil, isProActive, proPriceCents } from '@/lib/plan';
import { myPlan } from '@/lib/plan-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const go = (k: 'ok' | 'erro', msg: string): never => redirect(`/painel/plano?${k}=${encodeURIComponent(msg)}`);

export async function subscribePro(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?voltar=/painel/plano');
  const name = String(formData.get('name') ?? '').trim().slice(0, 100);
  const cpf = String(formData.get('cpf') ?? '');
  if (name.length < 2) go('erro', 'Informe o nome do responsável ou da empresa');
  if (!validCpfCnpj(cpf)) go('erro', 'CPF ou CNPJ inválido');

  const current = await myPlan(supabase, user!.id);
  if (current?.status === 'ativo' && current.source === 'asaas' && current.asaas_subscription_id) go('erro', 'Você já tem o Pro ativo');
  if (current?.status === 'pendente' && current.invoice_url) redirect(current.invoice_url);

  const admin = createAdminClient();
  const now = new Date().toISOString();
  if (paymentProvider() !== 'asaas') {
    // Modo de teste: libera o Pro na hora, por um mês.
    await admin.from('plans').upsert({ owner_id: user!.id, status: 'ativo', source: 'asaas', paid_until: extendPaidUntil(current?.paid_until ?? null, now.slice(0, 10)), updated_at: now });
    revalidatePath('/painel');
    go('ok', 'Pro ativado (modo de teste, sem cobrança)');
  }

  let sub: Awaited<ReturnType<typeof createAsaasSubscription>>;
  try {
    sub = await createAsaasSubscription({ ownerId: user!.id, name, email: user!.email ?? '', cpfCnpj: onlyDigits(cpf), valueCents: proPriceCents() });
  } catch (e) {
    go('erro', e instanceof Error ? `Asaas: ${e.message}` : 'Não foi possível criar a assinatura');
  }
  const { error } = await admin.from('plans').upsert({
    owner_id: user!.id, status: isProActive(current) ? 'ativo' : 'pendente', source: 'asaas',
    paid_until: current?.paid_until ?? null, asaas_customer_id: sub!.customerId, asaas_subscription_id: sub!.subscriptionId,
    invoice_url: sub!.invoiceUrl, updated_at: now,
  });
  if (error) go('erro', 'Assinatura criada no Asaas, mas não foi possível salvar. Fale com a Campia.');
  if (sub!.invoiceUrl) redirect(sub!.invoiceUrl);
  go('ok', 'Assinatura criada. A cobrança chega no seu e-mail pelo Asaas.');
}

export async function cancelPro() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?voltar=/painel/plano');
  const plan = await myPlan(supabase, user!.id);
  if (!plan || plan.source !== 'asaas') go('erro', 'Nenhuma assinatura para cancelar');
  if (plan!.asaas_subscription_id && paymentProvider() === 'asaas') {
    try { await cancelAsaasSubscription(plan!.asaas_subscription_id); }
    catch (e) { go('erro', e instanceof Error ? `Asaas: ${e.message}` : 'Não foi possível cancelar'); }
  }
  await createAdminClient().from('plans').update({ status: 'cancelado', asaas_subscription_id: null, invoice_url: null, updated_at: new Date().toISOString() }).eq('owner_id', user!.id);
  revalidatePath('/painel');
  go('ok', isProActive(plan) ? 'Assinatura cancelada. O Pro continua até o fim do período pago.' : 'Assinatura cancelada.');
}
