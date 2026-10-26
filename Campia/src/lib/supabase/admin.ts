import { createClient } from '@supabase/supabase-js';

/**
 * Cliente com a service role: ignora o RLS. Só no servidor, só para o que o público
 * não pode fazer sozinho (reservar vaga, criar e confirmar pagamento).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
