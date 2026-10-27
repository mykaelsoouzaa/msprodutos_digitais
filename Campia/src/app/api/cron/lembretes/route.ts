import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { addDays } from '@/lib/domain/build';
import { DEFAULT_LEADS, LEAD_LABEL, dueReminders } from '@/lib/domain/reminders';
import { type GameRow, toGame } from '@/lib/data';
import { fmtDate } from '@/lib/format';
import { sendEmail } from '@/lib/email';
import { duePixReminders, pixReminderEmail } from '@/lib/payment-reminder';
import { freeSlots, waitlistEmail, waitlistToNotify } from '@/lib/waitlist';
import { sendPush } from '@/lib/push';
import { siteUrl } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { beat, logEvent } from '@/lib/monitor';
import { WA_TEMPLATES, sendWhatsapp, whatsappEnabled } from '@/lib/whatsapp';

// Envia os lembretes de jogo. Chamar a cada 10 minutos (ver README: Supabase Cron).
// Protegido por CRON_SECRET no cabeçalho Authorization: Bearer <segredo>.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

interface SubRow { id: string; championship_id: string; team_id: string | null; endpoint: string; p256dh: string; auth: string; leads: number[] }

/** E-mail para o capitão que reservou a vaga e ainda não pagou o PIX (uma vez por inscrição). */
async function remindPendingPix(db: ReturnType<typeof createAdminClient>, now: number) {
  const { data } = await db.from('payments')
    .select('id, team_id, amount_cents, status, created_at, reminder_sent_at, teams(name, reserved_until, status), championships(name)')
    .eq('status', 'pendente').is('reminder_sent_at', null).lte('created_at', new Date(now - 10 * 60_000).toISOString()).limit(100)
    .returns<Array<{ id: string; team_id: string; amount_cents: number; status: string; created_at: string; reminder_sent_at: string | null;
      teams: { name: string; reserved_until: string | null; status: string } | null; championships: { name: string } | null }>>();
  const rows = (data ?? []).filter(r => r.teams?.status === 'reservada').map(r => ({ ...r, reserved_until: r.teams?.reserved_until ?? null }));
  const due = duePixReminders(rows, now);
  if (!due.length) return { sent: 0 };
  const { data: contacts } = await db.from('team_contacts').select('team_id, captain_email').in('team_id', due.map(d => d.team_id))
    .returns<Array<{ team_id: string; captain_email: string }>>();
  let sent = 0;
  for (const p of due) {
    const email = contacts?.find(c => c.team_id === p.team_id)?.captain_email;
    if (!email) continue;
    // Marca antes de enviar: se o agendador rodar duas vezes, o segundo não reenvia.
    const { data: claimed } = await db.from('payments').update({ reminder_sent_at: new Date(now).toISOString() })
      .eq('id', p.id).is('reminder_sent_at', null).select('id');
    if (!claimed?.length) continue;
    const minutesLeft = Math.floor((Date.parse(p.reserved_until!) - now) / 60_000);
    const msg = pixReminderEmail({ team: p.teams!.name, championship: p.championships?.name ?? 'campeonato', amountCents: p.amount_cents, url: `${siteUrl()}/pagamento/${p.id}`, minutesLeft });
    const r = await sendEmail({ to: email, subject: msg.subject, html: msg.html });
    if (r === 'ok') sent++;
    if (r === 'skipped') await db.from('payments').update({ reminder_sent_at: null }).eq('id', p.id); // sem chave do Brevo: tenta de novo depois
  }
  return { sent };
}

/** Avisa a lista de espera quando abre vaga (desistência ou PIX não pago). */
async function notifyWaitlist(db: ReturnType<typeof createAdminClient>, now: number) {
  const { data: entries } = await db.from('waitlist').select('id, championship_id, team_name, email, created_at, notified_at').limit(1000)
    .returns<Array<{ id: string; championship_id: string; team_name: string; email: string; created_at: string; notified_at: string | null }>>();
  const champIds = [...new Set((entries ?? []).filter(e => !e.notified_at).map(e => e.championship_id))];
  let sent = 0;
  for (const cid of champIds) {
    const [{ data: champ }, { data: teams }, { data: started }] = await Promise.all([
      db.from('championships').select('name, slug, fee_cents').eq('id', cid).maybeSingle<{ name: string; slug: string; fee_cents: number }>(),
      db.from('teams').select('status, reserved_until').eq('championship_id', cid).returns<Array<{ status: string; reserved_until: string | null }>>(),
      db.from('games').select('id').eq('championship_id', cid).not('home_score', 'is', null).limit(1),
    ]);
    if (!champ || started?.length) continue; // campeonato começou: não abre mais vaga
    const fila = (entries ?? []).filter(e => e.championship_id === cid);
    for (const e of waitlistToNotify(fila, freeSlots(teams ?? [], now), now)) {
      const { data: claimed } = await db.from('waitlist').update({ notified_at: new Date(now).toISOString() }).eq('id', e.id).is('notified_at', null).select('id');
      if (!claimed?.length) continue;
      const msg = waitlistEmail({ team: e.team_name, championship: champ.name, feeCents: champ.fee_cents, url: `${siteUrl()}/c/${champ.slug}/inscricao` });
      const r = await sendEmail({ to: e.email, subject: msg.subject, html: msg.html });
      if (r === 'ok') sent++;
      if (r === 'skipped') await db.from('waitlist').update({ notified_at: null }).eq('id', e.id);
    }
  }
  return { sent };
}

/** Grava a chave antes de enviar: se já existe, a mensagem já saiu (ou está saindo) e não repete. */
async function claimWhatsapp(db: ReturnType<typeof createAdminClient>, key: string) {
  const { error } = await db.from('whatsapp_sent').insert({ key });
  return !error;
}

/**
 * WhatsApp oficial (só campeonatos de organizadores Pro, porque cada mensagem tem custo):
 * lembrete do jogo para os capitães ~3 h antes e aviso de pagamento pendente.
 */
async function whatsappReminders(db: ReturnType<typeof createAdminClient>, now: number) {
  if (!whatsappEnabled()) return { skipped: true };
  const proCache = new Map<string, boolean>();
  const isPro = async (owner: string) => {
    if (!proCache.has(owner)) { const { data } = await db.rpc('pro_owner', { p_owner: owner }); proCache.set(owner, data === true); }
    return proCache.get(owner)!;
  };
  const br = new Date(now - 3 * 3600_000);
  const today = br.toISOString().slice(0, 10);
  const nowMin = br.getUTCHours() * 60 + br.getUTCMinutes();
  let jogos = 0, pix = 0;

  // Jogos de hoje que começam entre 2h30 e 3h a partir de agora.
  const { data: games } = await db.from('games').select('id, championship_id, home_team_id, away_team_id, time, field, home_score')
    .eq('date', today).is('home_score', null).not('home_team_id', 'is', null).not('away_team_id', 'is', null)
    .returns<Array<{ id: string; championship_id: string; home_team_id: string; away_team_id: string; time: string; field: string }>>();
  const soon = (games ?? []).filter(g => { const [h, m] = (g.time || '').split(':').map(Number); const t = h * 60 + m; return Number.isFinite(t) && t - nowMin >= 150 && t - nowMin <= 180; });
  for (const g of soon) {
    const { data: c } = await db.from('championships').select('owner_id, name, slug').eq('id', g.championship_id).maybeSingle<{ owner_id: string; name: string; slug: string }>();
    if (!c || !(await isPro(c.owner_id))) continue;
    const { data: teams } = await db.from('teams').select('id, name').in('id', [g.home_team_id, g.away_team_id]).returns<Array<{ id: string; name: string }>>();
    const { data: contacts } = await db.from('team_contacts').select('team_id, captain_phone').in('team_id', [g.home_team_id, g.away_team_id]).returns<Array<{ team_id: string; captain_phone: string }>>();
    const name = (id: string) => teams?.find(t => t.id === id)?.name ?? '?';
    for (const tid of [g.home_team_id, g.away_team_id]) {
      const phone = contacts?.find(x => x.team_id === tid)?.captain_phone;
      if (!phone || !(await claimWhatsapp(db, `jogo:${g.id}:${tid}`))) continue;
      const r = await sendWhatsapp(phone, WA_TEMPLATES.jogo(), [name(tid), `${name(g.home_team_id)} x ${name(g.away_team_id)}`, `hoje às ${g.time}${g.field ? ` (${g.field})` : ''}`, `${siteUrl()}/c/${c.slug}`]);
      if (r === 'ok') jogos++; else if (r !== 'skipped') await logEvent('whatsapp', r);
    }
  }

  // Inscrição reservada há mais de 10 min e ainda sem pagamento.
  const { data: pays } = await db.from('payments').select('id, team_id, championship_id, created_at')
    .eq('status', 'pendente').lte('created_at', new Date(now - 10 * 60_000).toISOString()).gte('created_at', new Date(now - 30 * 60_000).toISOString()).limit(100)
    .returns<Array<{ id: string; team_id: string; championship_id: string }>>();
  for (const p of pays ?? []) {
    const [{ data: c }, { data: t }, { data: ct }] = await Promise.all([
      db.from('championships').select('owner_id, name').eq('id', p.championship_id).maybeSingle<{ owner_id: string; name: string }>(),
      db.from('teams').select('name, status').eq('id', p.team_id).maybeSingle<{ name: string; status: string }>(),
      db.from('team_contacts').select('captain_phone').eq('team_id', p.team_id).maybeSingle<{ captain_phone: string }>(),
    ]);
    if (!c || !t || t.status !== 'reservada' || !ct?.captain_phone || !(await isPro(c.owner_id))) continue;
    if (!(await claimWhatsapp(db, `pix:${p.id}`))) continue;
    const r = await sendWhatsapp(ct.captain_phone, WA_TEMPLATES.pix(), [t.name, c.name, `${siteUrl()}/pagamento/${p.id}`]);
    if (r === 'ok') pix++; else if (r !== 'skipped') await logEvent('whatsapp', r);
  }
  return { jogos, pix };
}

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(got, secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const now = Date.now();
  await beat('agendador');
  // Limpeza: falhas registradas há mais de 30 dias.
  await db.from('system_events').delete().lt('created_at', new Date(now - 30 * 86400_000).toISOString()).then(() => {}, () => {});
  const pix = await remindPendingPix(db, now).catch(async e => { await logEvent('agendador-erro', `Lembrete de PIX: ${e instanceof Error ? e.message : e}`); return { error: true }; });
  const espera = await notifyWaitlist(db, now).catch(async e => { await logEvent('agendador-erro', `Lista de espera: ${e instanceof Error ? e.message : e}`); return { error: true }; });
  const whatsapp = await whatsappReminders(db, now).catch(async e => { await logEvent('agendador-erro', `WhatsApp: ${e instanceof Error ? e.message : e}`); return { error: true }; });
  const todayBr = new Date(now - 3 * 3600_000).toISOString().slice(0, 10);
  const leads = [...new Set([...DEFAULT_LEADS, 180, 30])];

  const { data: rows, error } = await db.from('games').select('*')
    .gte('date', todayBr).lte('date', addDays(todayBr, 2))
    .is('home_score', null).not('home_team_id', 'is', null).not('away_team_id', 'is', null)
    .returns<GameRow[]>();
  if (error) { await logEvent('agendador-erro', `Busca de jogos: ${error.message}`); return NextResponse.json({ error: error.message }, { status: 500 }); }

  const due = dueReminders((rows ?? []).map(toGame), now, leads);
  if (!due.length) return NextResponse.json({ ok: true, sent: 0, pix, espera, whatsapp });

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
  return NextResponse.json({ ok: true, due: due.length, sent, removed, pix, espera, whatsapp });
}

export const GET = run;
export const POST = run;
