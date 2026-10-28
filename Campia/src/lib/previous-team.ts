// Inscrever de novo: acha o último time do capitão (pelo e-mail do login) para preencher o formulário.
import { playersText } from './previous-team-text';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PreviousTeam {
  champName: string; name: string; short: string; captain: string; phone: string; players: string;
}

/** O e-mail precisa vir da sessão validada; a busca usa a chave do servidor porque os contatos são privados. */
export async function previousTeam(email: string, currentChampId: string, sport: string): Promise<PreviousTeam | null> {
  if (!email) return null;
  try {
    const db = createAdminClient();
    const { data: contacts } = await db.from('team_contacts').select('team_id, championship_id, captain_phone')
      .eq('captain_email', email.toLowerCase()).neq('championship_id', currentChampId).limit(50)
      .returns<Array<{ team_id: string; championship_id: string; captain_phone: string }>>();
    if (!contacts?.length) return null;
    const { data: champs } = await db.from('championships').select('id, name, sport, created_at')
      .in('id', [...new Set(contacts.map(c => c.championship_id))])
      .returns<Array<{ id: string; name: string; sport: string; created_at: string }>>();
    const best = (champs ?? []).sort((a, b) => Number(b.sport === sport) - Number(a.sport === sport) || b.created_at.localeCompare(a.created_at))[0];
    const contact = best && contacts.find(c => c.championship_id === best.id);
    if (!contact) return null;
    const [{ data: team }, { data: players }] = await Promise.all([
      db.from('teams').select('name, short, captain_name, status').eq('id', contact.team_id).maybeSingle<{ name: string; short: string; captain_name: string; status: string }>(),
      db.from('players').select('name, number').eq('team_id', contact.team_id).order('number').returns<Array<{ name: string; number: string }>>(),
    ]);
    if (!team || team.status !== 'inscrita') return null;
    return { champName: best.name, name: team.name, short: team.short, captain: team.captain_name, phone: contact.captain_phone, players: playersText(players ?? []) };
  } catch {
    return null;
  }
}
