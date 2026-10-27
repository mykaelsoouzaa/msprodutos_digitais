'use server';
// Cancelar inscrição (liberando a vaga) e devolver PIX pelo Asaas.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { loadChampionship, type PaymentRow } from '@/lib/data';
import { isDecided } from '@/lib/domain/standings';
import { refundPix } from '@/lib/payments';
import { logEvent } from '@/lib/monitor';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const go = (path: string, k: 'ok' | 'erro', msg: string): never =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(msg)}`);

async function requireOwner(champId: string, back: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const data = await loadChampionship(supabase, { id: champId });
  if (!data || data.row.owner_id !== user!.id) go(back, 'erro', 'Campeonato não encontrado');
  return { supabase, data: data! };
}

/** Faz o estorno no Asaas e marca o pagamento como estornado. Devolve a mensagem de erro, se houver. */
async function refund(p: PaymentRow): Promise<string | null> {
  try {
    await refundPix(p.provider, p.provider_id, p.provider_installment_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'O Asaas não aceitou a devolução';
    await logEvent('estorno', `Pagamento ${p.id}: ${msg}`);
    return msg;
  }
  // O organizador não altera pagamentos pelo RLS: o servidor grava com a service role.
  await createAdminClient().from('payments').update({ status: 'estornado', refunded_at: new Date().toISOString() }).eq('id', p.id);
  return null;
}

export async function cancelRegistration(formData: FormData) {
  const champId = String(formData.get('championship'));
  const teamId = String(formData.get('team'));
  const back = `/painel/${champId}/time/${teamId}`;
  if (formData.get('confirm') !== 'CANCELAR') go(back, 'erro', 'Digite CANCELAR para confirmar');
  const { supabase, data } = await requireOwner(champId, back);
  const team = data.teams.find(t => t.id === teamId);
  if (!team || team.status === 'aberta') go(back, 'erro', 'Essa vaga já está livre');
  if (data.games.some(g => isDecided(g) && (g.homeId === teamId || g.awayId === teamId))) {
    go(back, 'erro', 'O time já tem jogos com resultado; a vaga não pode ser liberada. Se precisar, devolva o valor pelo Asaas.');
  }

  let refunded = false;
  if (formData.get('refund') === '1') {
    const { data: pay } = await supabase.from('payments').select('*').eq('team_id', teamId).eq('status', 'pago')
      .order('paid_at', { ascending: false }).limit(1).maybeSingle<PaymentRow>();
    if (pay) {
      const err = await refund(pay);
      if (err) go(back, 'erro', `Devolução não feita: ${err}. A inscrição continua ativa.`);
      refunded = true;
    }
  }

  // Libera a vaga: volta a ser "Vaga N", sem atletas nem contatos.
  const admin = createAdminClient();
  await admin.from('payments').update({ status: 'cancelado' }).eq('team_id', teamId).eq('status', 'pendente');
  await supabase.from('players').delete().eq('team_id', teamId);
  await supabase.from('team_contacts').delete().eq('team_id', teamId);
  await supabase.from('teams').update({
    status: 'aberta', paid: false, name: `Vaga ${team!.slot}`, short: `V${team!.slot}`, captain_name: '', reserved_until: null,
  }).eq('id', teamId);

  revalidatePath(`/c/${data.champ.slug}`);
  go(`/painel/${champId}?aba=times`, 'ok', refunded ? `Inscrição de ${team!.name} cancelada e PIX devolvido` : `Inscrição de ${team!.name} cancelada. A vaga está livre.`);
}

/** Devolve um PIX que caiu depois de a vaga expirar (a vaga já foi para outro time). */
export async function refundLatePayment(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=times`;
  const { supabase } = await requireOwner(champId, back);
  const { data: pay } = await supabase.from('payments').select('*').eq('id', String(formData.get('payment')))
    .eq('championship_id', champId).eq('status', 'pago_tarde').maybeSingle<PaymentRow>();
  if (!pay) go(back, 'erro', 'Pagamento não encontrado');
  const err = await refund(pay!);
  if (err) go(back, 'erro', `Devolução não feita: ${err}`);
  go(back, 'ok', 'PIX devolvido');
}
