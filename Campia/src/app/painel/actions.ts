'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { roleIn } from '@/lib/access';
import { gameRow, loadChampionship, persistKnockout, teamRow } from '@/lib/data';
import { buildPlan, teamCountError } from '@/lib/domain/build';
import { SPORTS, allowsOnline } from '@/lib/domain/sports';
import { scoreError } from '@/lib/domain/standings';
import { UFS, slugify } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

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
});

export async function createChampionship(formData: FormData) {
  const { supabase, user } = await requireUser();
  const parsed = NewChampionship.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail('/painel/novo', parsed.error.issues[0].message);
  const f = parsed.data!;
  const countErr = teamCountError(f.format, f.teams);
  if (countErr) fail('/painel/novo', countErr);

  const schedule = { start: f.start, times: f.times, fields: f.fields };
  const plan = buildPlan({ format: f.format, teamCount: f.teams, schedule });
  const slug = `${slugify(f.name)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: champ, error } = await supabase.from('championships').insert({
    owner_id: user.id, slug, name: f.name, sport: f.sport, format: f.format, fee_cents: Math.round(f.fee * 100),
    ...place(f.sport, f), visibility: f.visibility,
    rules: { qualify: plan.qualify, tiebreak: ['v', 'sg', 'gp', 'cd'] }, schedule,
  }).select('id').single();
  if (error || !champ) fail('/painel/novo', 'Não foi possível criar o campeonato');

  const teamsRes = await supabase.from('teams').insert(plan.teams.map(t => teamRow(champ!.id, t)));
  const gamesRes = teamsRes.error ? teamsRes : await supabase.from('games').insert(plan.games.map(g => gameRow(champ!.id, g)));
  if (teamsRes.error || gamesRes.error) {
    await supabase.from('championships').delete().eq('id', champ!.id);
    fail('/painel/novo', 'Não foi possível gerar a tabela. Tente de novo.');
  }
  redirect(`/painel/${champ!.id}?aba=times&ok=${encodeURIComponent('Campeonato criado! Agora mande o link de inscrição no grupo.')}`);
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

  const home = int(formData.get('home')), away = int(formData.get('away'));
  const penHome = int(formData.get('penHome')), penAway = int(formData.get('penAway'));
  const err = home === null || away === null ? 'Preencha o placar' : scoreError(data!.champ, g!, home, away, penHome, penAway);
  if (err) fail(back, err);

  // Gols por atleta: campos "goal_<playerId>"
  const teamIds = new Set([g!.homeId, g!.awayId]);
  const goals: Array<{ game_id: string; player_id: string; team_id: string; championship_id: string; count: number }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('goal_')) continue;
    const count = Number(value);
    const player = data!.players.find(p => p.id === key.slice(5));
    if (player && teamIds.has(player.teamId) && Number.isInteger(count) && count > 0 && count < 200) {
      goals.push({ game_id: gameId, player_id: player.id, team_id: player.teamId, championship_id: champId, count });
    }
  }

  const tie = home === away && g!.stage === 'ko';
  const { error } = await supabase.from('games').update({
    home_score: home, away_score: away, pen_home: tie ? penHome : null, pen_away: tie ? penAway : null,
    date: date || null, time, field,
  }).eq('id', gameId);
  if (error) fail(back, 'Não foi possível salvar o resultado');

  await supabase.from('goals').delete().eq('game_id', gameId);
  if (goals.length) await supabase.from('goals').insert(goals);

  Object.assign(g!, { homeScore: home, awayScore: away, penHome: tie ? penHome : null, penAway: tie ? penAway : null });
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
  const { error } = await supabase.from('games').update({ home_score: null, away_score: null, pen_home: null, pen_away: null }).eq('id', gameId);
  if (error) fail(`/painel/${champId}/jogo/${gameId}`, 'Não foi possível apagar');
  await supabase.from('goals').delete().eq('game_id', gameId);
  const data = await loadChampionship(supabase, { id: champId });
  if (data) await persistKnockout(supabase, data);
  revalidatePath(`/painel/${champId}`);
  redirect(`/painel/${champId}?aba=jogos&ok=${encodeURIComponent('Resultado apagado')}`);
}

/** O organizador recebeu por fora (dinheiro, transferência) e confirma a vaga manualmente. */
export async function markPaidManually(formData: FormData) {
  const { supabase } = await requireUser();
  const champId = String(formData.get('championship'));
  const teamId = String(formData.get('team'));
  const { error } = await supabase.from('teams').update({ paid: true, status: 'inscrita', reserved_until: null }).eq('id', teamId).eq('championship_id', champId);
  if (error) fail(`/painel/${champId}?aba=times`, 'Não foi possível confirmar');
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
