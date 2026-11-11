// Entrada pela área do cliente da MS Soluções (mssolucoestech.com.br), sem pedir outro login.
// Mesmo contrato da Nina e da Campia: o portal assina um acesso (JWT EdDSA) que vale 60 segundos
// e uma vez só, com aud = "ofertix".
import { createPublicKey, verify, createHmac, timingSafeEqual } from 'node:crypto';
import type { DB } from './db.ts';

export interface AcessoPortal { email: string; nome: string; jti: string; exp: number; codigo: string; admin: boolean }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function conferirAcessoPortal(
  token: string,
  opts: { chave: string; emissor: string; agora?: number },
): AcessoPortal | null {
  const partes = token.split('.');
  if (!opts.chave || partes.length !== 3 || token.length > 4000) return null;
  try {
    const cab = JSON.parse(Buffer.from(partes[0], 'base64url').toString());
    if (cab.alg !== 'EdDSA') return null;
    const ok = verify(null, Buffer.from(`${partes[0]}.${partes[1]}`), createPublicKey(opts.chave), Buffer.from(partes[2], 'base64url'));
    if (!ok) return null;
    const d = JSON.parse(Buffer.from(partes[1], 'base64url').toString());
    const agora = (opts.agora ?? Date.now()) / 1000;
    if (d.aud !== 'ofertix' || d.iss !== opts.emissor.replace(/\/+$/, '')) return null;
    if (typeof d.exp !== 'number' || d.exp < agora || typeof d.iat !== 'number' || d.iat > agora + 30) return null;
    if (typeof d.jti !== 'string' || typeof d.email !== 'string' || !EMAIL.test(d.email)) return null;
    return {
      email: d.email.toLowerCase(), nome: typeof d.nome === 'string' ? d.nome.slice(0, 60) : '', jti: d.jti.slice(0, 80), exp: d.exp,
      codigo: typeof d.codigo === 'string' ? d.codigo.slice(0, 60) : '', admin: d.admin === true,
    };
  } catch {
    return null;
  }
}

/** Marca o acesso como usado. Retorna false se já tinha sido usado. */
export function usarAcesso(db: DB, jti: string, exp: number): boolean {
  db.prepare('DELETE FROM acessos_usados WHERE expira_em < ?').run(Math.floor(Date.now() / 1000) - 86400);
  const r = db.prepare('INSERT OR IGNORE INTO acessos_usados (jti, expira_em) VALUES (?, ?)').run(jti, exp);
  return Number(r.changes) === 1;
}

// ---- Sessão em cookie assinado (HMAC) ----

export interface Sessao { conta: number; email: string; nome: string; demo: boolean; admin: boolean; leitura: boolean; exp: number }

export function assinarSessao(s: Sessao, segredo: string): string {
  const corpo = Buffer.from(JSON.stringify(s)).toString('base64url');
  const sig = createHmac('sha256', segredo).update(corpo).digest('base64url');
  return `${corpo}.${sig}`;
}

export function lerSessao(valor: string | undefined, segredo: string, agora = Date.now()): Sessao | null {
  if (!valor || !segredo) return null;
  const [corpo, sig] = valor.split('.');
  if (!corpo || !sig) return null;
  const esperado = createHmac('sha256', segredo).update(corpo).digest();
  const recebido = Buffer.from(sig, 'base64url');
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return null;
  try {
    const s = JSON.parse(Buffer.from(corpo, 'base64url').toString()) as Sessao;
    return s.exp > agora ? s : null;
  } catch {
    return null;
  }
}
