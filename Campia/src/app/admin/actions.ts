'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdmin(user?.email)) redirect('/painel');
}

/** Marca (ou desmarca) que o repasse manual de uma inscrição já foi transferido ao organizador. */
export async function togglePayoutDone(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('payment'));
  const done = formData.get('done') === '1';
  await createAdminClient().from('payments').update({ manual_payout_done_at: done ? new Date().toISOString() : null })
    .eq('id', id).eq('payout', 'manual');
  revalidatePath('/admin');
  redirect(`/admin?ok=${encodeURIComponent(done ? 'Repasse marcado como feito' : 'Repasse voltou para pendente')}`);
}
