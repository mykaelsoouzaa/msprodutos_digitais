'use server';
// Edição de um campeonato já criado: dados básicos, agenda, refazer a tabela e editar times/atletas.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { gameRow, loadChampionship, teamRow } from '@/lib/data';
import { applySchedule, buildPlan, teamCountError } from '@/lib/domain/build';
import { isDecided } from '@/lib/domain/standings';
import { normalizePhone, parsePlayers, shortName } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

const go = (path: string, k: 'ok' | 'erro', msg: string): never =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(msg)}`);

/** Só o dono edita. Devolve o campeonato carregado (com contatos). */
async function requireOwner(champId: string, back: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');
  const data = await loadChampionship(supabase, { id: champId }, { withContacts: true });
  if (!data || data.row.owner_id !== user!.id) go(back, 'erro', 'Campeonato não encontrado');
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
