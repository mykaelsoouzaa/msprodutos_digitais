'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/** Esconde o "Primeiros passos" (fica salvo neste navegador por 1 ano). */
export async function hideOnboarding() {
  (await cookies()).set('campia-passos', 'ocultar', { path: '/painel', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  redirect('/painel');
}
