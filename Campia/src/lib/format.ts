// Utilidades de texto e formatação (sem dependências).

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

export const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getUTCDay()];
  return `${wd}, ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const onlyDigits = (s: string) => s.replace(/\D/g, '');

/** Telefone brasileiro com DDD (10 ou 11 dígitos), com ou sem +55. */
export function normalizePhone(s: string): string | null {
  let d = onlyDigits(s);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
}

export function waLink(phone: string, text: string): string {
  const p = normalizePhone(phone);
  return `https://wa.me/${p ? '55' + p : ''}?text=${encodeURIComponent(text)}`;
}

/** Sigla de 3 letras a partir do nome. */
export function shortName(name: string, given?: string): string {
  const s = (given || name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9&]/g, '');
  return (s.slice(0, 3) || 'TIM').toUpperCase();
}

export interface ParsedPlayer { name: string; number: string }

/** Uma linha por atleta: "10 João", "João" ou "João 10". */
export function parsePlayers(text: string): ParsedPlayer[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 40).map(line => {
    const first = line.match(/^(\d{1,3})\s+(.+)$/);
    if (first) return { number: first[1], name: first[2].trim() };
    const last = line.match(/^(.+?)\s+(\d{1,3})$/);
    if (last) return { number: last[2], name: last[1].trim() };
    return { number: '', name: line };
  }).filter(p => p.name.length <= 60);
}

/** CPF ou CNPJ com dígitos verificadores válidos. */
export function validCpfCnpj(s: string): boolean {
  const d = onlyDigits(s);
  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + Number(base[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  if (d.length === 11 && !/^(\d)\1+$/.test(d)) {
    const d1 = calc(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calc(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === Number(d[9]) && d2 === Number(d[10]);
  }
  if (d.length === 14 && !/^(\d)\1+$/.test(d)) {
    const d1 = calc(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calc(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === Number(d[12]) && d2 === Number(d[13]);
  }
  return false;
}
