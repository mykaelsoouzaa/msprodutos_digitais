// Remarcar uma rodada inteira: soma dias à data dos jogos ainda sem resultado.
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function validShift(days: number) {
  return Number.isInteger(days) && days !== 0 && Math.abs(days) <= 90;
}
