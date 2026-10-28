'use server';
import { redirect } from 'next/navigation';
import { paymentProvider } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyPaymentConfirmed } from '@/lib/payment-notify';

/** Só existe no modo simulado: confirma o pagamento como se o banco tivesse avisado. */
export async function simulatePayment(formData: FormData) {
  if (paymentProvider() !== 'mock') redirect('/');
  const id = String(formData.get('payment'));
  const db = createAdminClient();
  const { data: p } = await db.from('payments').select('provider').eq('id', id).maybeSingle();
  if (p?.provider === 'mock') { await db.rpc('confirm_payment', { p_payment: id }); await notifyPaymentConfirmed(id); }
  redirect(`/pagamento/${id}`);
}
