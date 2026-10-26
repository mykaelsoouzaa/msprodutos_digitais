'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { paymentProvider } from '@/lib/env';
import { platformWalletId } from '@/lib/payments/asaas';
import { WALLET_RE } from '@/lib/payout';
import { createClient } from '@/lib/supabase/server';

const back = (k: 'ok' | 'erro', msg: string): never => redirect(`/painel/recebimentos?${k}=${encodeURIComponent(msg)}`);

/** Salva a conta Asaas do organizador pelo Wallet ID (identifica a conta que recebe; não dá acesso a ela). */
export async function savePayout(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?voltar=/painel/recebimentos');

  const walletId = String(formData.get('walletId') || '').trim();
  if (!WALLET_RE.test(walletId)) back('erro', 'Wallet ID inválido: são 36 caracteres no formato 0000aaaa-00aa-...');
  if (paymentProvider() === 'asaas') {
    // O Asaas recusa split para a própria carteira: avisa já na hora de conectar.
    const own = await platformWalletId().catch(() => null);
    if (own && own.toLowerCase() === walletId.toLowerCase()) {
      back('erro', 'Esse Wallet ID é da conta da Campia. Use o Wallet ID da conta Asaas do organizador (outra conta).');
    }
  }

  const { error } = await supabase.from('payout_accounts')
    .upsert({ owner_id: user!.id, asaas_wallet_id: walletId.toLowerCase(), updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
  if (error) back('erro', 'Não foi possível salvar');
  revalidatePath('/painel/recebimentos');
  back('ok', 'Conta Asaas conectada. As próximas inscrições já caem direto na sua conta.');
}

export async function removePayout() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?voltar=/painel/recebimentos');
  await supabase.from('payout_accounts').delete().eq('owner_id', user!.id);
  revalidatePath('/painel/recebimentos');
  back('ok', 'Repasse automático desligado. As próximas inscrições serão repassadas manualmente.');
}
