import { createClient } from '@supabase/supabase-js';

/**
 * Cliente sem sessão (chave pública): enxerga só o que qualquer visitante vê.
 * Usado nas consultas guardadas em cache, que não podem depender do usuário logado.
 */
export function createPublicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
