'use server';
// Edição de um campeonato já criado: dados básicos, agenda, refazer a tabela e editar times/atletas.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { gameRow, loadChampionship, teamRow } from '@/lib/data';
import { applySchedule, buildPlan, gamesFor, shuffled, teamCountError } from '@/lib/domain/build';
import { isDecided } from '@/lib/domain/standings';
import { normalizePhone, parsePlayers, shortName } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { canManage } from '@/lib/access';

const go = (path: string, k: 'ok' | 'erro', msg: string): never =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(msg)}`);

/** Só o dono edita. Devolve o campeonato carregado (com contatos). */
async function requireOwner(champId: string, back: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const data = await loadChampionship(supabase, { id: champId }, { withContacts: true });
  if (!data || !(await canManage(supabase, data.row, user))) go(back, 'erro', 'Campeonato não encontrado');
  return { supabase, data: data! };
}

const list = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12);

/* ---------- nome e valor ---------- */
export async function updateBasics(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes`;
  const f = z.object({
    name: z.string().trim().min(3, 'Nome muito curto').max(80),
    fee: z.coerce.number().min(0).max(100000),
  }).safeParse(Object.fromEntries(formData));
  if (!f.success) go(back, 'erro', f.error!.issues[0].message);
  const { supabase, data } = await requireOwner(champId, back);
  const { error } = await supabase.from('championships')
    .update({ name: f.data!.name, fee_cents: Math.round(f.data!.fee * 100) }).eq('id', champId);
  if (error) go(back, 'erro', 'Não foi possível salvar');
  revalidatePath(`/c/${data.champ.slug}`);
  go(back, 'ok', 'Dados do campeonato salvos. O novo valor vale para as próximas inscrições.');
}

/* ---------- agenda ---------- */
export async function updateSchedule(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes`;
  const f = z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    times: z.string().transform(list).refine(a => a.length && a.every(t => /^\d{2}:\d{2}$/.test(t)), 'Horários no formato 09:00, 10:00'),
    fields: z.string().transform(list).refine(a => a.length > 0, 'Informe pelo menos um campo ou quadra'),
  }).safeParse(Object.fromEntries(formData));
  if (!f.success) go(back, 'erro', f.error!.issues[0].message);
  const { supabase, data } = await requireOwner(champId, back);

  const schedule = { start: f.data!.start, times: f.data!.times, fields: f.data!.fields };
  // Jogos já realizados ficam como estão; os demais são remarcados.
  applySchedule(data.games, schedule, isDecided);
  await supabase.from('championships').update({ schedule }).eq('id', champId);
  for (const g of data.games) {
    await supabase.from('games').update({ date: g.date || null, time: g.time, field: g.field, sort: g.sort }).eq('id', g.id);
  }
  revalidatePath(`/c/${data.champ.slug}`);
  go(back, 'ok', 'Agenda refeita. Jogos já realizados não mudaram.');
}

/* ---------- refazer a tabela (formato e nº de times) ---------- */
export async function rebuildChampionship(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes`;
  const f = z.object({
    format: z.enum(['pontos', 'grupos', 'mata']),
    teams: z.coerce.number().int(),
  }).safeParse(Object.fromEntries(formData));
  if (!f.success) go(back, 'erro', 'Formato ou número de times inválido');
  const { supabase, data } = await requireOwner(champId, back);
  if (data.teams.some(t => t.status !== 'aberta')) go(back, 'erro', 'Já há times inscritos ou com vaga reservada. Cancele as inscrições antes de refazer a tabela.');
  if (data.games.some(isDecided)) go(back, 'erro', 'O campeonato já tem resultados; a tabela não pode ser refeita.');
  const err = teamCountError(f.data!.format, f.data!.teams);
  if (err) go(back, 'erro', err);

  const plan = buildPlan({ format: f.data!.format, teamCount: f.data!.teams, schedule: data.champ.schedule });
  // Times apagados levam junto jogos (set null) e pagamentos antigos; jogos são apagados antes.
  await supabase.from('games').delete().eq('championship_id', champId);
  await supabase.from('teams').delete().eq('championship_id', champId);
  const t = await supabase.from('teams').insert(plan.teams.map(x => teamRow(champId, x)));
  const g = t.error ? t : await supabase.from('games').insert(plan.games.map(x => gameRow(champId, x)));
  if (t.error || g.error) go(back, 'erro', 'Não foi possível refazer a tabela. Tente de novo.');
  await supabase.from('championships').update({
    format: f.data!.format, rules: { ...data.champ.rules, qualify: plan.qualify },
  }).eq('id', champId);
  revalidatePath(`/c/${data.champ.slug}`);
  go(`/painel/${champId}?aba=times`, 'ok', 'Tabela refeita com o novo formato.');
}

/* ---------- editar um time (ou inscrever manualmente numa vaga) ---------- */
export async function saveTeam(formData: FormData) {
  const champId = String(formData.get('championship'));
  const teamId = String(formData.get('team'));
  const back = `/painel/${champId}/time/${teamId}`;
  const f = z.object({
    name: z.string().trim().min(2, 'Nome do time muito curto').max(40),
    short: z.string().trim().max(3).default(''),
    captain: z.string().trim().max(60).default(''),
    phone: z.string().trim().default(''),
    email: z.union([z.string().trim().toLowerCase().email('E-mail do capitão inválido').max(120), z.literal('')]).default(''),
    novos: z.string().max(4000).default(''),
    manual: z.literal('1').optional(),
  }).safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string')));
  if (!f.success) go(back, 'erro', f.error!.issues[0].message);
  const v = f.data!;
  const phone = v.phone ? normalizePhone(v.phone) : '';
  if (phone === null) go(back, 'erro', 'WhatsApp com DDD inválido');

  const { supabase, data } = await requireOwner(champId, back);
  const team = data.teams.find(t => t.id === teamId);
  if (!team) go(`/painel/${champId}?aba=times`, 'erro', 'Time não encontrado');
  if (team!.status === 'aberta' && v.manual !== '1') go(back, 'erro', 'Vaga livre: marque "inscrever manualmente" para ocupar a vaga.');

  // Dados do time. Inscrição manual = pago por fora (dinheiro, transferência) ou cortesia.
  const patch: Record<string, unknown> = { name: v.name, short: shortName(v.name, v.short), captain_name: v.captain };
  if (team!.status === 'aberta') Object.assign(patch, { status: 'inscrita', paid: true, reserved_until: null });
  const { error } = await supabase.from('teams').update(patch).eq('id', teamId);
  if (error) go(back, 'erro', 'Não foi possível salvar o time');
  await supabase.from('team_contacts').upsert(
    { team_id: teamId, championship_id: champId, captain_phone: phone ?? '', captain_email: v.email },
    { onConflict: 'team_id' },
  );

  // Atletas existentes: renomear, mudar número ou remover.
  const roster = data.players.filter(p => p.teamId === teamId);
  for (const p of roster) {
    if (formData.get(`remove_${p.id}`) === 'on') {
      await supabase.from('players').delete().eq('id', p.id); // leva junto gols e cartões dele
      continue;
    }
    const name = String(formData.get(`pname_${p.id}`) ?? p.name).trim().slice(0, 60);
    const number = String(formData.get(`pnum_${p.id}`) ?? p.number).trim().slice(0, 3);
    if (name && (name !== p.name || number !== p.number)) await supabase.from('players').update({ name, number }).eq('id', p.id);
  }
  // Novos atletas: um por linha.
  const novos = parsePlayers(v.novos);
  if (novos.length) {
    await supabase.from('players').insert(novos.map(p => ({ championship_id: champId, team_id: teamId, name: p.name, number: p.number })));
  }

  revalidatePath(`/c/${data.champ.slug}`);
  go(`/painel/${champId}?aba=times`, 'ok', team!.status === 'aberta' ? `${v.name} inscrito manualmente` : `${v.name} atualizado`);
}

/* ---------- sorteio dos grupos (ou dos confrontos do mata-mata) ---------- */
export async function drawChampionship(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=times`;
  const { supabase, data } = await requireOwner(champId, back);
  if (data.champ.format === 'pontos') go(back, 'erro', 'Em pontos corridos todos jogam contra todos: não há sorteio.');
  if (data.games.some(isDecided)) go(back, 'erro', 'O campeonato já tem resultados; o sorteio não pode ser refeito.');

  const order = shuffled(data.teams);
  const { games } = gamesFor(data.champ.format, order, data.champ.schedule, data.champ.rules.qualify);
  await supabase.from('games').delete().eq('championship_id', champId);
  for (const t of order) await supabase.from('teams').update({ grp: t.group }).eq('id', t.id);
  const { error } = await supabase.from('games').insert(games.map(g => gameRow(champId, g)));
  if (error) go(back, 'erro', 'Não foi possível salvar o sorteio. Tente de novo.');
  await supabase.from('championships').update({ rules: { ...data.champ.rules, drawnAt: new Date().toISOString() } }).eq('id', champId);
  revalidatePath(`/c/${data.champ.slug}`);
  go(`/painel/${champId}?aba=tabela`, 'ok', data.champ.format === 'grupos' ? 'Grupos sorteados! Confira a tabela.' : 'Confrontos sorteados! Confira a chave.');
}

/* ---------- lotes de preço ---------- */
export async function updatePriceTiers(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes`;
  const tiers: Array<{ until: string; cents: number }> = [];
  for (let i = 0; i < 3; i++) {
    const until = String(formData.get(`until_${i}`) || '');
    const value = String(formData.get(`value_${i}`) || '').replace(',', '.');
    if (!until && !value) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || !value || Number.isNaN(Number(value)) || Number(value) < 0) {
      go(back, 'erro', `Lote ${i + 1}: preencha a data e o valor`);
    }
    tiers.push({ until, cents: Math.round(Number(value) * 100) });
  }
  tiers.sort((a, b) => a.until.localeCompare(b.until));
  if (new Set(tiers.map(t => t.until)).size !== tiers.length) go(back, 'erro', 'Dois lotes com a mesma data');
  const { supabase, data } = await requireOwner(champId, back);
  const { error } = await supabase.from('championships').update({ price_tiers: tiers }).eq('id', champId);
  if (error) go(back, 'erro', 'Não foi possível salvar os lotes');
  revalidatePath(`/c/${data.champ.slug}`);
  go(back, 'ok', tiers.length ? 'Lotes de preço salvos' : 'Lotes removidos: vale o valor da inscrição');
}

/* ---------- cupons ---------- */
export async function addCoupon(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes`;
  const code = String(formData.get('code') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const kind = formData.get('kind') === 'valor' ? 'valor' : 'percent';
  const value = Number(String(formData.get('value') || '').replace(',', '.'));
  const max = String(formData.get('max') || '').trim();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) go(back, 'erro', 'Código do cupom: de 3 a 20 letras ou números');
  if (!(value > 0) || (kind === 'percent' && value > 100)) go(back, 'erro', 'Desconto inválido');
  if (max && !(Number.isInteger(Number(max)) && Number(max) > 0)) go(back, 'erro', 'Limite de usos inválido');
  const { supabase } = await requireOwner(champId, back);
  const { error } = await supabase.from('coupons').insert({
    championship_id: champId, code,
    percent: kind === 'percent' ? Math.round(value) : null,
    amount_cents: kind === 'valor' ? Math.round(value * 100) : null,
    max_uses: max ? Number(max) : null,
  });
  if (error) go(back, 'erro', error.code === '23505' ? 'Já existe um cupom com esse código' : 'Não foi possível criar o cupom');
  go(back, 'ok', `Cupom ${code} criado`);
}

export async function removeCoupon(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes`;
  const { supabase } = await requireOwner(champId, back);
  await supabase.from('coupons').delete().eq('id', String(formData.get('coupon'))).eq('championship_id', champId);
  go(back, 'ok', 'Cupom removido');
}

/* ---------- votação do craque ---------- */
export async function setVoting(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes`;
  const state = String(formData.get('state'));
  if (!['fechada', 'aberta', 'encerrada'].includes(state)) go(back, 'erro', 'Opção inválida');
  const { supabase, data } = await requireOwner(champId, back);
  await supabase.from('championships').update({ voting: state }).eq('id', champId);
  revalidatePath(`/c/${data.champ.slug}`);
  go(back, 'ok', state === 'aberta' ? 'Votação aberta! Divulgue o link da página do campeonato.' : state === 'encerrada' ? 'Votação encerrada: o resultado está na página do campeonato.' : 'Votação fechada');
}

/* ---------- cartão de crédito ---------- */
export async function updateCardOption(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes#cartao`;
  const { supabase } = await requireOwner(champId, back);
  const n = Math.max(0, Math.min(12, Math.floor(Number(formData.get('card_installments') ?? 0)) || 0));
  const { error } = await supabase.from('championships').update({ card_installments: n }).eq('id', champId);
  if (error) go(back, 'erro', 'Não foi possível salvar');
  revalidatePath(`/painel/${champId}`);
  go(back, 'ok', n === 0 ? 'Inscrição só no PIX' : n === 1 ? 'Cartão liberado (à vista)' : `Cartão liberado em até ${n}x`);
}

/* ---------- regulamento ---------- */
export async function updateRegulation(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes#regulamento`;
  const { supabase, data } = await requireOwner(champId, back);
  const text = String(formData.get('regulation') ?? '').replace(/\r\n/g, '\n').trim();
  if (text.length > 10000) go(back, 'erro', 'O regulamento pode ter até 10.000 caracteres');
  const { error } = await supabase.from('championships').update({ rules: { ...data.row.rules, regulation: text } }).eq('id', champId);
  if (error) go(back, 'erro', 'Não foi possível salvar');
  revalidatePath(`/c/${data.row.slug}`);
  go(back, 'ok', text ? 'Regulamento salvo: aparece na aba Regulamento e na inscrição' : 'Regulamento removido');
}

/* ---------- premiação ---------- */
export async function updatePrizes(formData: FormData) {
  const champId = String(formData.get('championship'));
  const back = `/painel/${champId}?aba=ajustes#premiacao`;
  const { supabase, data } = await requireOwner(champId, back);
  const field = (k: string) => String(formData.get(k) ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const prizes = { first: field('first'), second: field('second'), third: field('third'), best: field('best') };
  const empty = !Object.values(prizes).some(Boolean);
  const { error } = await supabase.from('championships').update({ rules: { ...data.row.rules, prizes: empty ? undefined : prizes } }).eq('id', champId);
  if (error) go(back, 'erro', 'Não foi possível salvar');
  revalidatePath(`/c/${data.row.slug}`);
  go(back, 'ok', empty ? 'Premiação removida' : 'Premiação salva: aparece na página e na inscrição');
}
