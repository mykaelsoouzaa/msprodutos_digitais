// Quais lembretes de jogo devem sair agora.
import type { Game } from './types';

/** Fuso dos horários cadastrados. O Brasil não tem horário de verão desde 2019. */
export const GAME_UTC_OFFSET = '-03:00';

/** Antecedências padrão: 1 dia e 1 hora antes. */
export const DEFAULT_LEADS = [1440, 60];

export const LEAD_LABEL: Record<number, string> = { 1440: 'amanhã', 180: 'daqui a 3 horas', 60: 'daqui a 1 hora', 30: 'daqui a 30 minutos' };

/** Início do jogo em milissegundos (UTC), ou null se não tiver data e horário. */
export function gameStart(g: Game): number | null {
  if (!g.date || !/^\d{2}:\d{2}$/.test(g.time)) return null;
  const t = Date.parse(`${g.date}T${g.time}:00${GAME_UTC_OFFSET}`);
  return Number.isNaN(t) ? null : t;
}

export interface DueReminder { game: Game; lead: number; startsAt: number }

/**
 * Lembretes cujo horário de envio (início − antecedência) caiu na janela (now − windowMin, now].
 * A janela deve ser um pouco maior que o intervalo do agendador, e o envio deve ser idempotente
 * (cada par jogo × antecedência × inscrito sai uma vez só), assim nenhum lembrete se perde nem repete.
 */
export function dueReminders(games: Game[], now: number, leads: number[] = DEFAULT_LEADS, windowMin = 20): DueReminder[] {
  const out: DueReminder[] = [];
  for (const game of games) {
    if (!game.homeId || !game.awayId || game.homeScore !== null) continue;
    const startsAt = gameStart(game);
    if (startsAt === null || startsAt <= now) continue;
    for (const lead of leads) {
      const sendAt = startsAt - lead * 60_000;
      if (sendAt <= now && sendAt > now - windowMin * 60_000) out.push({ game, lead, startsAt });
    }
  }
  return out;
}
