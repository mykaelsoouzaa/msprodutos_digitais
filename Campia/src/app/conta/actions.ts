'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Nome que aparece no topo do site e no painel. */
export async function updateName(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (name.length < 2) redirect(`/conta?erro=${encodeURIComponent('Digite seu nome (pelo menos 2 letras)')}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { name } });
  if (error) redirect(`/conta?erro=${encodeURIComponent('Não foi possível salvar o nome')}`);
  redirect(`/conta?ok=${encodeURIComponent('Nome salvo')}`);
}

/** Apaga a conta e os dados ligados a ela (LGPD). */
export async function deleteAccount(formData: FormData) {
  if (formData.get('confirm') !== 'EXCLUIR') redirect(`/conta?erro=${encodeURIComponent('Digite EXCLUIR para confirmar')}#excluir`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { canSelfDelete } = await import('@/lib/my-data');
  const admin = createAdminClient();
  const email = (user!.email ?? '').toLowerCase();

  const { data: own } = await admin.from('championships').select('id').eq('owner_id', user!.id).returns<Array<{ id: string }>>();
  const ids = (own ?? []).map(c => c.id);
  const { count: paid } = ids.length
    ? await admin.from('payments').select('id', { count: 'exact', head: true }).in('championship_id', ids).in('status', ['pago', 'pago_tarde', 'estornado'])
    : { count: 0 };
  if (!canSelfDelete(paid ?? 0)) {
    redirect(`/conta?erro=${encodeURIComponent('Seus campeonatos têm inscrições pagas, que precisamos guardar por obrigação fiscal. Escreva para contato@campia.app.br e encerramos a conta com você.')}#excluir`);
  }

  // Assinatura do Pro: cancela no Asaas para não cobrar mais.
  const { data: plan } = await admin.from('plans').select('asaas_subscription_id').eq('owner_id', user!.id).maybeSingle<{ asaas_subscription_id: string | null }>();
  if (plan?.asaas_subscription_id) {
    const { cancelAsaasSubscription } = await import('@/lib/payments/asaas');
    await cancelAsaasSubscription(plan.asaas_subscription_id).catch(() => {});
  }
  // Tira o e-mail de onde ele aparece sem ligação com a conta.
  if (email) {
    await admin.from('team_contacts').update({ captain_email: '' }).eq('captain_email', email);
    await admin.from('waitlist').delete().eq('email', email);
    await admin.from('championship_helpers').delete().eq('email', email);
  }
  // Apagar o usuário leva junto: campeonatos (sem pagamento), arena, perfil de atleta, votos, procuro time, plano.
  const { error } = await admin.auth.admin.deleteUser(user!.id);
  if (error) redirect(`/conta?erro=${encodeURIComponent('Não foi possível excluir agora. Tente de novo ou escreva para contato@campia.app.br.')}#excluir`);
  await supabase.auth.signOut().catch(() => {});
  redirect('/conta-excluida');
}
