import { createBrowserClient } from '@supabase/ssr';

/** Cliente do navegador (mesma sessão dos cookies). Usado só onde precisa ser no aparelho, como a verificação em duas etapas. */
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
