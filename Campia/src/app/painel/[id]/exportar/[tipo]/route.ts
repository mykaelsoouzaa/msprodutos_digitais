import { type Cell, brDateTime, fileName, money, toCsv } from '@/lib/csv';
import { loadChampionship } from '@/lib/data';
import { isDecided } from '@/lib/domain/standings';
import { ownerIsPro } from '@/lib/plan-server';
import { createClient } from '@/lib/supabase/server';

const STATUS: Record<string, string> = {
  pendente: 'Aguardando PIX', pago: 'Pago', pago_tarde: 'Pago depois do prazo', expirado: 'Expirado',
  cancelado: 'Cancelado', estornado: 'Devolvido',
};
const TEAM_STATUS: Record<string, string> = { aberta: 'Vaga livre', reservada: 'Reservada', inscrita: 'Inscrito' };

/** Baixa uma planilha do campeonato (só o dono: tem telefones e pagamentos). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; tipo: string }> }) {
  const { id, tipo } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Entre na sua conta', { status: 401 });
  const data = await loadChampionship(supabase, { id }, { withContacts: true });
  if (!data || data.row.owner_id !== user.id) return new Response('Campeonato não encontrado', { status: 404 });
  if (!(await ownerIsPro(supabase, user.id))) return new Response('Planilhas fazem parte do Plano Pro: campia.app.br/painel/plano', { status: 403 });

  const { champ, teams, players, games, goals } = data;
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  let header: string[];
  let rows: Cell[][];

  if (tipo === 'times') {
    const { data: contacts } = await supabase.from('team_contacts').select('team_id, captain_phone, captain_email').eq('championship_id', id)
      .returns<Array<{ team_id: string; captain_phone: string; captain_email: string }>>();
    const contact = new Map((contacts ?? []).map(c => [c.team_id, c]));
    header = ['Vaga', 'Time', 'Sigla', 'Grupo', 'Situação', 'Pago', 'Capitão', 'WhatsApp', 'E-mail', 'Atletas'];
    rows = teams.map(t => [
      t.slot, t.name, t.short, t.group ?? '', TEAM_STATUS[t.status] ?? t.status, t.paid, t.captainName,
      contact.get(t.id)?.captain_phone ?? '', contact.get(t.id)?.captain_email ?? '', players.filter(p => p.teamId === t.id).length,
    ]);
  } else if (tipo === 'atletas') {
    header = ['Time', 'Atleta', 'Número', 'Gols'];
    rows = [...players]
      .sort((a, b) => (teamName.get(a.teamId) ?? '').localeCompare(teamName.get(b.teamId) ?? '') || a.name.localeCompare(b.name))
      .map(p => [teamName.get(p.teamId) ?? '', p.name, p.number, goals.filter(g => g.playerId === p.id).reduce((s, g) => s + (g.count ?? 1), 0)]);
  } else if (tipo === 'pagamentos') {
    const { data: pays } = await supabase.from('payments')
      .select('team_id, amount_cents, discount_cents, coupon_code, status, payout, created_at, paid_at, refunded_at, method, installments')
      .eq('championship_id', id).order('created_at')
      .returns<Array<{ team_id: string; amount_cents: number; discount_cents: number | null; coupon_code: string | null; status: string; payout: string | null; created_at: string; paid_at: string | null; refunded_at: string | null; method: string | null; installments: number | null }>>();
    header = ['Time', 'Valor (R$)', 'Desconto (R$)', 'Cupom', 'Forma', 'Situação', 'Repasse', 'Criado em', 'Pago em', 'Devolvido em'];
    rows = (pays ?? []).map(p => [
      teamName.get(p.team_id) ?? '(time removido)', money(p.amount_cents), money(p.discount_cents ?? 0), p.coupon_code ?? '',
      p.method === 'cartao' ? `Cartão${p.installments && p.installments > 1 ? ` ${p.installments}x` : ''}` : 'PIX',
      STATUS[p.status] ?? p.status, p.payout === 'automatico' ? 'Automático' : 'Manual',
      brDateTime(p.created_at), brDateTime(p.paid_at), brDateTime(p.refunded_at),
    ]);
  } else if (tipo === 'jogos') {
    header = ['Rodada', 'Data', 'Horário', 'Local', 'Mandante', 'Gols', 'Gols', 'Visitante', 'Pênaltis', 'Situação'];
    rows = games.map(g => [
      [g.group ? `Grupo ${g.group}` : '', g.label, g.name].filter(Boolean).join(' · '), g.date ? g.date.split('-').reverse().join('/') : '', g.time, g.field,
      g.homeId ? teamName.get(g.homeId) ?? '' : '', g.homeScore, g.awayScore, g.awayId ? teamName.get(g.awayId) ?? '' : '',
      g.penHome != null ? `${g.penHome} x ${g.penAway}` : '',
      g.wo ? 'W.O.' : isDecided(g) ? 'Encerrado' : 'A jogar',
    ]);
  } else {
    return new Response('Planilha inválida', { status: 404 });
  }

  return new Response(toCsv(header, rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${fileName(champ.slug, tipo)}"`,
      'cache-control': 'no-store',
    },
  });
}
