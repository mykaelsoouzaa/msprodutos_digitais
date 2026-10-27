import { NextResponse } from 'next/server';
import { displayName } from '@/lib/account';
import { isAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Quem está logado (para o menu da conta no topo). Nunca vai para cache. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const body = user
    ? { logged: true, email: user.email ?? '', name: displayName(user.user_metadata?.name, user.email), admin: isAdmin(user.email) }
    : { logged: false };
  const res = NextResponse.json(body);
  res.headers.set('cache-control', 'private, no-store');
  return res;
}
