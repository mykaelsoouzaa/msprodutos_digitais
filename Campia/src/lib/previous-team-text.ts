/** Linhas "10 João" para a caixa de atletas. */
export function playersText(list: Array<{ name: string; number: string }>) {
  return list.map(p => (p.number ? `${p.number} ${p.name}` : p.name)).join('\n');
}
