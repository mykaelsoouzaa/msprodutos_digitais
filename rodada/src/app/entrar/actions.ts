'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { siteUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

const safePath = (p: string) => (p.startsWith('/') && !p.startsWith('//') ? p : '/painel');

export async function sendMagicLink(formData: FormData) {
  const email = z.string().trim().email().safeParse(formData.get('email'));
  const back = safePath(String(formData.get('voltar') || '/painel'));
  if (!email.success) redirect(`/entrar?erro=${encodeURIComponent('Digite um e-mail válido')}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?voltar=${encodeURIComponent(back)}` },
  });
  if (error) redirect(`/entrar?erro=${encodeURIComponent('Não foi possível enviar o link. Tente de novo em instantes.')}`);
  redirect('/entrar?enviado=1');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
