import { type CookieOptions, createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Renova a sessão do Supabase a cada requisição e protege o painel.
export async function middleware(request: NextRequest) {
  // Se o Supabase devolver o login para outra página (ex.: "/?code=..." quando o endereço de retorno
  // não está na lista de Redirect URLs), encaminha para /auth/callback para concluir o login.
  const code = request.nextUrl.searchParams.get('code');
  if (code && request.nextUrl.pathname !== '/auth/callback' && /^[0-9a-f-]{20,}$/i.test(code)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    url.search = '';
    url.searchParams.set('code', code);
    url.searchParams.set('voltar', request.nextUrl.pathname === '/' ? '/painel' : request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && (request.nextUrl.pathname.startsWith('/painel') || request.nextUrl.pathname.startsWith('/meus-times') || request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname === '/atleta')) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.searchParams.set('voltar', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Link de indicação (?indicacao=codigo): guarda por 60 dias para dar o crédito a quem indicou.
  const ref = request.nextUrl.searchParams.get('indicacao');
  if (ref && /^[a-z0-9]{6,12}$/.test(ref) && !request.cookies.get('campia-indicacao')) {
    response.cookies.set('campia-indicacao', ref, { path: '/', maxAge: 60 * 60 * 24 * 60, sameSite: 'lax', httpOnly: true });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
