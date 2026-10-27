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
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/conta#seguranca');
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

/** Pro de cortesia (parceiros, campeonatos da própria Campia): por e-mail, por N meses. Meses 0 tira a cortesia. */
export async function grantCourtesy(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const months = Math.max(0, Math.min(24, Number(formData.get('months') ?? 0) || 0));
  const db = createAdminClient();
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const target = data?.users.find((u: { email?: string }) => (u.email ?? '').toLowerCase() === email);
  if (!target) redirect(`/admin?ok=${encodeURIComponent('Nenhuma conta com esse e-mail (a pessoa precisa entrar na Campia uma vez)')}`);
  const until = new Date();
  until.setUTCMonth(until.getUTCMonth() + months);
  const now = new Date().toISOString();
  const { data: cur } = await db.from('plans').select('source').eq('owner_id', target!.id).maybeSingle();
  if (cur && cur.source === 'asaas' && months > 0) redirect(`/admin?ok=${encodeURIComponent('Essa conta já tem assinatura pelo Asaas')}`);
  await db.from('plans').upsert({ owner_id: target!.id, source: 'cortesia', status: months ? 'ativo' : 'cancelado', paid_until: months ? until.toISOString() : now, updated_at: now });
  revalidatePath('/admin');
  redirect(`/admin?ok=${encodeURIComponent(months ? `Pro de cortesia para ${email} por ${months} ${months > 1 ? 'meses' : 'mês'}` : `Cortesia de ${email} encerrada`)}`);
}

/** Apaga qualquer campeonato (com tudo que é dele). Pede EXCLUIR digitado. */
export async function adminDeleteChampionship(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('championship') ?? '');
  if (formData.get('confirm') !== 'EXCLUIR') redirect(`/admin?ok=${encodeURIComponent('Digite EXCLUIR para confirmar')}#campeonatos`);
  const db = createAdminClient();
  const { data: c } = await db.from('championships').select('name, slug').eq('id', id).maybeSingle<{ name: string; slug: string }>();
  if (!c) redirect(`/admin?ok=${encodeURIComponent('Campeonato não encontrado')}#campeonatos`);
  const { error } = await db.from('championships').delete().eq('id', id);
  if (error) redirect(`/admin?ok=${encodeURIComponent(`Não foi possível excluir: ${error.message}`)}#campeonatos`);
  revalidatePath('/admin');
  revalidatePath(`/c/${c!.slug}`);
  redirect(`/admin?ok=${encodeURIComponent(`"${c!.name}" excluído`)}#campeonatos`);
}
