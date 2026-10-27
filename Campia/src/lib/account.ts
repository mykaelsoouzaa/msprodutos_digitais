// Conta do usuário: nome que aparece e regras da verificação em duas etapas.

/** Nome salvo na conta ou, se não tiver, a parte antes do @ do e-mail. */
export function displayName(saved: unknown, email: string | null | undefined): string {
  const name = typeof saved === 'string' ? saved.trim() : '';
  if (name) return name.slice(0, 60);
  const local = (email ?? '').split('@')[0] ?? '';
  return local ? local.slice(0, 40) : 'Minha conta';
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

/** Páginas que pedem o código do app quando a pessoa ativou a verificação em duas etapas. */
export const MFA_PROTECTED = ['/painel', '/admin', '/meus-times', '/atleta', '/conta'];

export function needsMfaStep(path: string, level: { currentLevel?: string | null; nextLevel?: string | null } | null | undefined) {
  if (!MFA_PROTECTED.some(p => path === p || path.startsWith(`${p}/`))) return false;
  if (path.startsWith('/atleta/') ) return false; // perfil público de atleta
  return level?.nextLevel === 'aal2' && level.currentLevel !== 'aal2';
}

/** Código de 6 dígitos do app autenticador. */
export const cleanCode = (s: string) => s.replace(/\D/g, '').slice(0, 6);
