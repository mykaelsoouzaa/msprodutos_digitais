import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { addDays } from '@/lib/domain/build';
import { DEFAULT_LEADS, LEAD_LABEL, dueReminders } from '@/lib/domain/reminders';
import { type GameRow, toGame } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { sendPush } from '@/lib/push';
import { createAdminClient } from '@/lib/supabase/admin';

// Envia os lembretes de jogo. Chamar a cada 10 minutos (ver README: Supabase Cron).
// Protegido por CRON_SECRET no cabeçalho Authorization: Bearer <segredo>.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

interface SubRow { id: string; championship_id: string; team_id: string | null; endpoint: string; p256dh: string; auth: string; leads: number[] }

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(got, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const now = Date.now();
  const todayBr = new Date(now - 3 * 3600_000).toISOString().slice(0, 10);
  const leads = [...new Set([...DEFAULT_LEADS, 180, 30])];

  const { data: rows, error } = await db.from('games').select('*')
    .gte('date', todayBr).lte('date', addDays(todayBr, 2))
    .is('home_score', null).not('home_team_id', 'is', null).not('away_team_id', 'is', null)
    .returns<GameRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = dueReminders((rows ?? []).map(toGame), now, leads);
  if (!due.length) return NextResponse.json({ ok: true, sent: 0 });

  const champIds = [...new Set(due.map(d => (rows ?? []).find(r => r.id === d.game.id)!.championship_id))];
  const [{ data: subs }, { data: champs }, { data: teams }] = await Promise.all([
    db.from('push_subscriptions').select('*').in('championship_id', champIds).returns<SubRow[]>(),
    db.from('championships').select('id, name, slug, location').in('id', champIds).returns<Array<{ id: string; name: string; slug: string; location: string }>>(),
    db.from('teams').select('id, name, short').in('championship_id', champIds).returns<Array<{ id: string; name: string; short: string }>>(),
  ]);
  const teamName = (id: string | null) => teams?.find(t => t.id === id)?.name ?? '?';

  let sent = 0, removed = 0;
  for (const { game, lead } of due) {
    const champId = (rows ?? []).find(r => r.id === game.id)!.championship_id;
    const champ = champs?.find(c => c.id === champId);
    if (!champ) continue;
    const targets = (subs ?? []).filter(s => s.championship_id === champId && s.leads.includes(lead)
      && (!s.team_id || s.team_id === game.homeId || s.team_id === game.awayId));

    for (const s of targets) {
      // Registra antes de enviar: se o agendador rodar duas vezes, o segundo envio é ignorado.
      const { error: dup } = await db.from('push_deliveries').insert({ subscription_id: s.id, game_id: game.id, lead });
      if (dup) continue;
      const result = await sendPush(s, {
        title: `⏰ Jogo ${LEAD_LABEL[lead] ?? 'em breve'}: ${teamName(game.homeId)} × ${teamName(game.awayId)}`,
        body: [fmtDate(game.date), game.time, game.field, champ.name].filter(Boolean).join(' · '),
        url: `/c/${champ.slug}`,
        tag: `${game.id}-${lead}`,
      });
      if (result === 'ok') sent++;
      if (result === 'gone') { await db.from('push_subscriptions').delete().eq('id', s.id); removed++; }
      // Falha temporária: apaga o registro para tentar de novo na próxima rodada do agendador.
      if (result === 'error') await db.from('push_deliveries').delete().match({ subscription_id: s.id, game_id: game.id, lead });
    }
  }
  return NextResponse.json({ ok: true, due: due.length, sent, removed });
}

export const GET = run;
export const POST = run;
