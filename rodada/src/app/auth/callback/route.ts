import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Destino do link mágico: troca o código pela sessão e volta para o painel.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const back = searchParams.get('voltar') || '/painel';
  const path = back.startsWith('/') && !back.startsWith('//') ? back : '/painel';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${path}`);
  }
  return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent('Link inválido ou expirado. Peça um novo.')}`);
}
