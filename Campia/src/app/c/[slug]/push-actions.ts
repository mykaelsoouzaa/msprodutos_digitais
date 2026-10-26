'use server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const Sub = z.object({
  championshipId: z.string().uuid(),
  teamId: z.string().uuid().nullable(),
  subscription: z.object({
    endpoint: z.string().url().startsWith('https://').max(1000),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  }),
});

type Result = { ok: true } | { ok: false; error: string };

/** Guarda a inscrição de notificações do aparelho (público, sem login). */
export async function subscribePush(input: unknown): Promise<Result> {
  const parsed = Sub.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dados de notificação inválidos' };
  const { championshipId, teamId, subscription } = parsed.data;
  const db = createAdminClient();

  const { data: champ } = await db.from('championships').select('id').eq('id', championshipId).maybeSingle();
  if (!champ) return { ok: false, error: 'Campeonato não encontrado' };
  if (teamId) {
    const { data: team } = await db.from('teams').select('id').eq('id', teamId).eq('championship_id', championshipId).maybeSingle();
    if (!team) return { ok: false, error: 'Time não encontrado' };
  }

  const { error } = await db.from('push_subscriptions').upsert({
    championship_id: championshipId, team_id: teamId, endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh, auth: subscription.keys.auth,
  }, { onConflict: 'endpoint,championship_id' });
  return error ? { ok: false, error: 'Não foi possível salvar' } : { ok: true };
}

export async function unsubscribePush(input: unknown): Promise<Result> {
  const parsed = z.object({ championshipId: z.string().uuid(), endpoint: z.string().url() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dados inválidos' };
  const db = createAdminClient();
  await db.from('push_subscriptions').delete().eq('championship_id', parsed.data.championshipId).eq('endpoint', parsed.data.endpoint);
  return { ok: true };
}
