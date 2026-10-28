'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { canManage, roleIn } from '@/lib/access';
import { gameRow, loadChampionship, persistKnockout, teamRow } from '@/lib/data';
import { buildPlan, teamCountError } from '@/lib/domain/build';
import { SPORTS, allowsOnline, sportRules } from '@/lib/domain/sports';
import { scoreError } from '@/lib/domain/standings';
import { editionInviteEmail } from '@/lib/edition';
import { sendEmail } from '@/lib/email';
import { siteUrl } from '@/lib/env';
import { UFS, slugify } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { attributeReferral } from '@/lib/referral-server';
import { notifyTeamConfirmed } from '@/lib/payment-notify';

const fail = (path: string, msg: string): never => redirect(`${path}${path.includes('?') ? '&' : '?'}erro=${encodeURIComponent(msg)}`);

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  return { supabase, user };
}

const list = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12);

const Place = {
  online: z.enum(['1', '']).optional(),
  location: z.string().trim().max(80).default(''),
  city: z.string().trim().max(60).default(''),
  state: z.union([z.enum(UFS), z.literal('')]).default(''),
};

/** Online só para e-sports; campeonato online não guarda endereço. */
function place(sport: string, f: { online?: '1' | ''; location: string; city: string; state: string }) {
  const online = f.online === '1' && allowsOnline(sport);
  return online ? { online, location: '', city: '', state: '' } : { online, location: f.location, city: f.city, state: f.state };
}

const NewChampionship = z.object({
  name: z.string().trim().min(3, 'Nome muito curto').max(80),
  sport: z.string().refine(s => s in SPORTS, 'Esporte inválido'),
  format: z.enum(['pontos', 'grupos', 'mata']),
  teams: z.coerce.number().int(),
  fee: z.coerce.number().min(0).max(100000),
  ...Place,
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  times: z.string().transform(list).refine(a => a.length && a.every(t => /^\d{2}:\d{2}$/.test(t)), 'Horários no formato 09:00, 10:00'),
  fields: z.string().transform(list).refine(a => a.length > 0, 'Informe pelo menos um campo ou quadra'),
  visibility: z.enum(['publico', 'link']).default('link'),
  from: z.string().uuid().optional(),
  invite: z.literal('1').optional(),
});

export async function createChampionship(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = NewChampionship.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail('/painel/novo', parsed.error.issues[0].message);
  const f = parsed.data!;
  const countErr = teamCountError(f.format, f.teams);
  if (countErr) fail('/painel/novo', countErr);

  const back = f.from ? `/painel/novo?de=${f.from}` : '/painel/novo';
  // Nova edição: herda as regras (limite de amarelos, desempate) do campeonato de origem, se for do mesmo dono.
  const { data: source } = f.from
    ? await supabase.from('championships').select('id, name, rules').eq('id', f.from).eq('owner_id', user.id).maybeSingle<{ id: string; name: string; rules: Record<string, unknown> }>()
    : { data: null };

  // Primeiro campeonato de quem chegou por indicação: registra quem indicou.
  const { count: owned } = await supabase.from('championships').select('id', { count: 'exact', head: true }).eq('owner_id', user.id);
  if (!owned) await attributeReferral(user.id);

  const schedule = { start: f.start, times: f.times, fields: f.fields };
  const plan = buildPlan({ format: f.format, teamCount: f.teams, schedule });
  const slug = `${slugify(f.name)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: champ, error } = await supabase.from('championships').insert({
    owner_id: user.id, slug, name: f.name, sport: f.sport, format: f.format, fee_cents: Math.round(f.fee * 100),
    ...place(f.sport, f), visibility: f.visibility,
    rules: {
      qualify: plan.qualify, tiebreak: (source?.rules?.tiebreak as string[] | undefined) ?? ['v', 'sg', 'gp', 'cd'],
      ...(source?.rules?.yellowLimit ? { yellowLimit: source.rules.yellowLimit } : {}),
    }, schedule,
  }).select('id').single();
  if (error || !champ) fail(back, 'Não foi possível criar o campeonato');

  const teamsRes = await supabase.from('teams').insert(plan.teams.map(t => teamRow(champ!.id, t)));
  const gamesRes = teamsRes.error ? teamsRes : await supabase.from('games').insert(plan.games.map(g => gameRow(champ!.id, g)));
  if (teamsRes.error || gamesRes.error) {
    await supabase.from('championships').delete().eq('id', champ!.id);
    fail(back, 'Não foi possível gerar a tabela. Tente de novo.');
  }

  let invited = 0;
  if (source && f.invite) invited = await inviteCaptains(supabase, user.id, source, { name: f.name, slug, feeCents: Math.round(f.fee * 100), start: f.start });
  const ok = source
    ? `Nova edição criada!${invited ? ` Convite enviado para ${invited} capitão${invited > 1 ? 'es' : ''}.` : ''} Agora mande o link de inscrição no grupo.`
    : 'Campeonato criado! Agora mande o link de inscrição no grupo.';
  redirect(`/painel/${champ!.id}?aba=times&ok=${encodeURIComponent(ok)}`);
}

/** Avisa por e-mail os capitães da edição anterior (um e-mail por endereço). Devolve quantos saíram. */
async function inviteCaptains(
  supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string,
  source: { id: string; name: string }, next: { name: string; slug: string; feeCents: number; start: string },
) {
  const [{ data: contacts }, { data: arena }] = await Promise.all([
    supabase.from('team_contacts').select('captain_email, teams(name)').eq('championship_id', source.id).neq('captain_email', '')
      .returns<Array<{ captain_email: string; teams: { name: string } | null }>>(),
    supabase.from('arenas').select('name').eq('owner_id', ownerId).maybeSingle<{ name: string }>(),
  ]);
  const seen = new Set<string>();
  let sent = 0;
  for (const c of contacts ?? []) {
    if (seen.has(c.captain_email)) continue;
    seen.add(c.captain_email);
    const mail = editionInviteEmail({
      team: c.teams?.name ?? 'seu time', previous: source.name, championship: next.name, feeCents: next.feeCents,
      start: next.start, url: `${siteUrl()}/c/${next.slug}/inscricao?origem=email`, organizer: arena?.name ?? 'o organizador',
    });
    if ((await sendEmail({ to: c.captain_email, subject: mail.subject, html: mail.html })) === 'ok') sent++;
  }
  return sent;
}

const int = (v: FormDataEntryValue | null) => (v === null || v === '' ? null : Number(v));

export async function saveResult(formData: FormData) {
  const { supabase, user } = await requireUser();
  const champId = String(formData.get('championship'));
  const gameId = String(formData.get('game'));
  const back = `/painel/${champId}/jogo/${gameId}`;

  const data = await loadChampionship(supabase, { id: champId });
  const g = data?.games.find(x => x.id === gameId);
  if (!data || !g || !g.homeId || !g.awayId) fail(back, 'Jogo não encontrado ou sem os dois times definidos');
  if (!(await roleIn(supabase, data!.row, user))) fail(back, 'Você não tem acesso a este campeonato');

  const date = String(formData.get('date') || '');
  const time = String(formData.get('time') || '');
  const field = String(formData.get('field') || '').slice(0, 40);
  const intent = String(formData.get('intent') || 'result');

  if (intent === 'schedule') {
    const { error } = await supabase.from('games').update({ date: date || null, time, field }).eq('id', gameId);
    if (error) fail(back, 'Não foi possível salvar');
    revalidatePath(`/painel/${champId}`);
    redirect(`/painel/${champId}?aba=jogos&ok=${encodeURIComponent('Data e horário salvos')}`);
  }

  const rules = sportRules(data!.champ.sport);
  const woRaw = String(formData.get('wo') || '');
  const wo = (['home', 'away', 'both'] as const).find(x => x === woRaw) ?? null;
  if (wo === 'both' && g!.stage === 'ko') fail(back, 'No mata-mata não existe W.O. duplo: escolha qual time faltou');

  let home = int(formData.get('home')), away = int(formData.get('away'));
  let penHome = int(formData.get('penHome')), penAway = int(formData.get('penAway'));
  if (wo) {
    // W.O.: placar padrão do esporte para o time presente; ninguém marca gol nem recebe cartão.
    const [w, l] = rules.woScore;
    [home, away] = wo === 'home' ? [l, w] : wo === 'away' ? [w, l] : [0, 0];
    penHome = penAway = null;
  } else {
    const err = home === null || away === null ? 'Preencha o placar' : scoreError(data!.champ, g!, home, away, penHome, penAway);
    if (err) fail(back, err);
  }

  // Gols por atleta: campos "goal_<playerId>"
  const teamIds = new Set([g!.homeId, g!.awayId]);
  const goals: Array<{ game_id: string; player_id: string; team_id: string; championship_id: string; count: number }> = [];
  for (const [key, value] of formData.entries()) {
    if (wo || !key.startsWith('goal_')) continue;
    const count = Number(value);
    const player = data!.players.find(p => p.id === key.slice(5));
    if (player && teamIds.has(player.teamId) && Number.isInteger(count) && count > 0 && count < 200) {
      goals.push({ game_id: gameId, player_id: player.id, team_id: player.teamId, championship_id: champId, count });
    }
  }

  // Cartões por atleta: "y_<playerId>" (0 a 2 amarelos) e "r_<playerId>" (vermelho)
  const cards: Array<{ game_id: string; player_id: string; team_id: string; championship_id: string; yellow: number; red: boolean }> = [];
  if (!wo && rules.cards) {
    for (const p of data!.players.filter(x => teamIds.has(x.teamId))) {
      const yellow = Math.min(2, Math.max(0, Number(formData.get(`y_${p.id}`) || 0) | 0));
      const red = formData.get(`r_${p.id}`) === 'on';
      if (yellow || red) cards.push({ game_id: gameId, player_id: p.id, team_id: p.teamId, championship_id: champId, yellow, red });
    }
  }

  const tie = !wo && home === away && g!.stage === 'ko';
  const { error } = await supabase.from('games').update({
    home_score: home, away_score: away, pen_home: tie ? penHome : null, pen_away: tie ? penAway : null, wo, live: false,
    date: date || null, time, field,
  }).eq('id', gameId);
  if (error) fail(back, 'Não foi possível salvar o resultado');

  await supabase.from('goals').delete().eq('game_id', gameId);
  if (goals.length) await supabase.from('goals').insert(goals);
  await supabase.from('cards').delete().eq('game_id', gameId);
  if (cards.length) await supabase.from('cards').insert(cards);

  Object.assign(g!, { homeScore: home, awayScore: away, penHome: tie ? penHome : null, penAway: tie ? penAway : null, wo });
  await persistKnockout(supabase, data!);

  revalidatePath(`/painel/${champId}`);
  revalidatePath(`/c/${data!.champ.slug}`);
  redirect(`/painel/${champId}?aba=jogos&ok=${encodeURIComponent('Resultado salvo · tabela atualizada')}`);
}

export async function clearResult(formData: FormData) {
  const { supabase, user } = await requireUser();
  const champId = String(formData.get('championship'));
  const gameId = String(formData.get('game'));
  const { data: c } = await supabase.from('championships').select('id, owner_id').eq('id', champId).maybeSingle();
  if (!c || !(await roleIn(supabase, c, user))) fail(`/painel/${champId}/jogo/${gameId}`, 'Você não tem acesso a este campeonato');
  const { error } = await supabase.from('games').update({ home_score: null, away_score: null, pen_home: null, pen_away: null, wo: null }).eq('id', gameId);
  if (error) fail(`/painel/${champId}/jogo/${gameId}`, 'Não foi possível apagar');
  await supabase.from('goals').delete().eq('game_id', gameId);
  await supabase.from('cards').delete().eq('game_id', gameId);
  const data = await loadChampionship(supabase, { id: champId });
  if (data) await persistKnockout(supabase, data);
  revalidatePath(`/painel/${champId}`);
  redirect(`/painel/${champId}?aba=jogos&ok=${encodeURIComponent('Resultado apagado')}`);
}

/** O organizador recebeu por fora (dinheiro, transferência) e confirma a vaga manualmente. */
export async function markPaidManually(formData: FormData) {
  const { supabase, user } = await requireUser();
  const champId = String(formData.get('championship'));
  const teamId = String(formData.get('team'));
  const { error } = await supabase.from('teams').update({ paid: true, status: 'inscrita', reserved_until: null }).eq('id', teamId).eq('championship_id', champId);
  if (error) fail(`/painel/${champId}?aba=times`, 'Não foi possível confirmar');
  // Pago por fora: cancela o PIX pendente. Se ele ainda for pago, o webhook registra como "pago_tarde" (para devolver).
  // O organizador não altera pagamentos pelo RLS; confere que o campeonato é dele e usa a service role.
  const { data: own } = await supabase.from('championships').select('id, owner_id').eq('id', champId).maybeSingle<{ id: string; owner_id: string }>();
  if (own && (await canManage(supabase, own, user))) {
    await createAdminClient().from('payments').update({ status: 'cancelado' }).eq('team_id', teamId).eq('championship_id', champId).eq('status', 'pendente');
    await notifyTeamConfirmed(champId, teamId, { amountCents: -1, method: 'pago direto ao organizador', paidAt: new Date().toISOString(), code: teamId.slice(0, 8).toUpperCase(), receiptUrl: null, key: `manual:${teamId}` });
  }
  revalidatePath(`/painel/${champId}`);
  redirect(`/painel/${champId}?aba=times&ok=${encodeURIComponent('Inscrição confirmada')}`);
}

export async function setCaptainEmail(formData: FormData) {
  const { supabase } = await requireUser();
  const champId = String(formData.get('championship'));
  const teamId = String(formData.get('team'));
  const back = `/painel/${champId}?aba=times`;
  const email = z.union([z.string().trim().toLowerCase().email().max(120), z.literal('')]).safeParse(String(formData.get('email') ?? '').trim());
  if (!email.success) fail(back, 'E-mail inválido');
  const { error } = await supabase.from('team_contacts')
    .upsert({ team_id: teamId, championship_id: champId, captain_email: email.data }, { onConflict: 'team_id' });
  if (error) fail(back, 'Não foi possível salvar o e-mail');
  revalidatePath(`/painel/${champId}`);
  redirect(`${back}&ok=${encodeURIComponent('E-mail do capitão salvo')}`);
}

const helpersBack = (id: string) => `/painel/${id}?aba=ajustes`;

export async function addHelper(formData: FormData) {
  const { supabase, user } = await requireUser();
  const champId = String(formData.get('championship'));
  const email = z.string().trim().toLowerCase().email().max(120).safeParse(formData.get('email'));
  if (!email.success) fail(helpersBack(champId), 'E-mail do ajudante inválido');
  if (email.data === (user.email ?? '').toLowerCase()) fail(helpersBack(champId), 'Esse é o seu próprio e-mail');
  const { count } = await supabase.from('championship_helpers').select('email', { count: 'exact', head: true }).eq('championship_id', champId);
  if ((count ?? 0) >= 10) fail(helpersBack(champId), 'Limite de 10 ajudantes por campeonato');
  const { error } = await supabase.from('championship_helpers').insert({ championship_id: champId, email: email.data });
  if (error) fail(helpersBack(champId), error.code === '23505' ? 'Esse e-mail já é ajudante' : 'Não foi possível adicionar');
  revalidatePath(`/painel/${champId}`);
  redirect(`${helpersBack(champId)}&ok=${encodeURIComponent('Ajudante adicionado. Mande o link para ele entrar.')}`);
}

export async function removeHelper(formData: FormData) {
  const { supabase } = await requireUser();
  const champId = String(formData.get('championship'));
  await supabase.from('championship_helpers').delete().eq('championship_id', champId).eq('email', String(formData.get('email')));
  revalidatePath(`/painel/${champId}`);
  redirect(`${helpersBack(champId)}&ok=${encodeURIComponent('Ajudante removido')}`);
}

export async function updateYellowLimit(formData: FormData) {
  const { supabase } = await requireUser();
  const champId = String(formData.get('championship'));
  const n = z.coerce.number().int().min(1).max(10).safeParse(formData.get('yellowLimit'));
  if (!n.success) fail(helpersBack(champId), 'Número de amarelos inválido');
  const { data: c } = await supabase.from('championships').select('rules').eq('id', champId).maybeSingle();
  if (!c) fail(helpersBack(champId), 'Campeonato não encontrado');
  await supabase.from('championships').update({ rules: { ...c!.rules, yellowLimit: n.data } }).eq('id', champId);
  revalidatePath(`/painel/${champId}`);
  redirect(`${helpersBack(champId)}&ok=${encodeURIComponent('Regra de cartões salva')}`);
}

export async function updateVisibility(formData: FormData) {
  const { supabase } = await requireUser();
  const champId = String(formData.get('championship'));
  const v = z.enum(['publico', 'link']).safeParse(formData.get('visibility'));
  if (!v.success) fail(`/painel/${champId}?aba=ajustes`, 'Opção inválida');
  await supabase.from('championships').update({ visibility: v.data }).eq('id', champId);
  revalidatePath(`/painel/${champId}`);
  redirect(`/painel/${champId}?aba=ajustes&ok=${encodeURIComponent('Visibilidade atualizada')}`);
}

export async function updatePlace(formData: FormData) {
  const { supabase } = await requireUser();
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes`;
  const parsed = z.object(Place).safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(back, 'Confira a cidade e o estado');
  const { data: c } = await supabase.from('championships').select('sport').eq('id', champId).maybeSingle();
  if (!c) fail(back, 'Campeonato não encontrado');
  const { error } = await supabase.from('championships').update(place(c!.sport, parsed.data!)).eq('id', champId);
  if (error) fail(back, 'Não foi possível salvar o local');
  revalidatePath(`/painel/${champId}`);
  redirect(`${back}&ok=${encodeURIComponent('Local atualizado')}`);
}

export async function deleteChampionship(formData: FormData) {
  const { supabase } = await requireUser();
  const champId = String(formData.get('championship'));
  if (formData.get('confirm') !== 'EXCLUIR') fail(`/painel/${champId}?aba=ajustes`, 'Digite EXCLUIR para confirmar');
  await supabase.from('championships').delete().eq('id', champId);
  revalidatePath('/painel');
  redirect('/painel?ok=' + encodeURIComponent('Campeonato excluído'));
}
