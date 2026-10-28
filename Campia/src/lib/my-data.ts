// LGPD: juntar os dados de uma pessoa (para baixar) e decidir se a conta pode ser apagada.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function collectMyData(admin: SupabaseClient, user: { id: string; email?: string | null; created_at?: string; user_metadata?: Record<string, unknown> }) {
  const email = (user.email ?? '').toLowerCase();
  const q = async <T,>(p: PromiseLike<{ data: T | null }>) => (await p).data ?? ([] as unknown as T);
  const contacts = await q(admin.from('team_contacts').select('team_id, championship_id, captain_phone, captain_email').eq('captain_email', email));
  const teamIds = (contacts as Array<{ team_id: string }>).map(c => c.team_id);
  return {
    gerado_em: new Date().toISOString(),
    conta: { id: user.id, email, nome: user.user_metadata?.name ?? null, criada_em: user.created_at ?? null },
    campeonatos_que_organiza: await q(admin.from('championships').select('id, name, slug, sport, created_at').eq('owner_id', user.id)),
    pagina_da_arena: await q(admin.from('arenas').select('name, slug, bio, address, city, state, whatsapp, instagram').eq('owner_id', user.id)),
    conta_para_receber: await q(admin.from('payout_accounts').select('asaas_wallet_id, updated_at').eq('owner_id', user.id)),
    plano: await q(admin.from('plans').select('status, source, paid_until, created_at').eq('owner_id', user.id)),
    times_como_capitao: contacts,
    pagamentos_dos_meus_times: teamIds.length ? await q(admin.from('payments').select('id, championship_id, team_id, amount_cents, status, method, created_at, paid_at, refunded_at').in('team_id', teamIds)) : [],
    lista_de_espera: await q(admin.from('waitlist').select('championship_id, team_name, captain_name, email, phone, created_at').eq('email', email)),
    procuro_time: await q(admin.from('free_agents').select('championship_id, name, position, phone, note, created_at').eq('user_id', user.id)),
    perfil_de_atleta: await q(admin.from('athletes').select('handle, name, city, state, bio, created_at').eq('user_id', user.id)),
    atletas_ligados: await q(admin.from('player_claims').select('player_id, championship_id, team_id, status, created_at').eq('user_id', user.id)),
    votos: await q(admin.from('votes').select('championship_id, category, player_id, created_at').eq('voter_id', user.id)),
    indicacoes: await q(admin.from('referrals').select('referred_id, created_at, rewarded_at').eq('referrer_id', user.id)),
  };
}

/** A conta só é apagada sozinha se não houver inscrição paga nos campeonatos da pessoa (registro fiscal). */
export function canSelfDelete(paidInOwnChampionships: number) {
  return paidInOwnChampionships === 0;
}
