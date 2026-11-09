// Entrada pela área do cliente da MS Soluções (mssolucoestech.com.br), sem pedir outro login.
// O portal assina um acesso (JWT EdDSA) que vale 60 segundos e uma vez só, para este sistema ("campia").
import { createPublicKey, verify } from 'node:crypto';

export interface AcessoPortal { email: string; nome: string; jti: string; exp: number }

/** Chave pública em uma linha (com \n no lugar das quebras), como fica na Vercel. */
export const chavePortal = (raw = process.env.PORTAL_CHAVE_PUBLICA) => (raw ?? '').replace(/\\n/g, '\n').trim();

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
    if (d.aud !== 'campia' || d.iss !== opts.emissor.replace(/\/+$/, '')) return null;
    if (typeof d.exp !== 'number' || d.exp < agora || typeof d.iat !== 'number' || d.iat > agora + 30) return null;
    if (typeof d.jti !== 'string' || typeof d.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return null;
    return { email: d.email.toLowerCase(), nome: typeof d.nome === 'string' ? d.nome.slice(0, 60) : '', jti: d.jti.slice(0, 80), exp: d.exp };
  } catch {
    return null;
  }
}
