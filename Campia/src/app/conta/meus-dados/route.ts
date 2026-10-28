import { collectMyData } from '@/lib/my-data';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Baixa um arquivo com tudo que a Campia guarda sobre a pessoa logada (LGPD). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Entre na sua conta', { status: 401 });
  const data = await collectMyData(createAdminClient(), user);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="meus-dados-campia.json"', 'cache-control': 'no-store' },
  });
}
