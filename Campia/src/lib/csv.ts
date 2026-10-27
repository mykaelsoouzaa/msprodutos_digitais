/**
 * Planilha CSV que abre certo no Excel em português: separador ";", BOM UTF-8 para os acentos
 * e proteção contra fórmula (um nome começando com "=" não vira cálculo).
 */
export type Cell = string | number | boolean | null | undefined;

export function csvCell(v: Cell) {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v);
  if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return '﻿' + [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

/** Valor em reais com vírgula (Excel pt-BR entende como número). */
export const money = (cents: number | null | undefined) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));

/** Data e hora de Brasília, "27/10/2026 14:05". */
export function brDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** Nome de arquivo seguro a partir do slug. */
export const fileName = (slug: string, kind: string) => `${slug.replace(/[^a-z0-9-]/g, '')}-${kind}.csv`;
