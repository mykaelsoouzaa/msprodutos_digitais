'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Nome que aparece no topo do site e no painel. */
export async function updateName(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (name.length < 2) redirect(`/conta?erro=${encodeURIComponent('Digite seu nome (pelo menos 2 letras)')}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { name } });
  if (error) redirect(`/conta?erro=${encodeURIComponent('Não foi possível salvar o nome')}`);
  redirect(`/conta?ok=${encodeURIComponent('Nome salvo')}`);
}
