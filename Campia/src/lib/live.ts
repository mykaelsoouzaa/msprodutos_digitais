/** Minutos desde o início do ao vivo ("23'"). Some se o jogo começou há mais de 3 horas (esqueceram de encerrar). */
export function liveMinute(since: string | null, now: number) {
  if (!since) return null;
  const min = Math.floor((now - new Date(since).getTime()) / 60000);
  return min < 0 || min > 180 ? null : Math.max(1, min + 1);
}
