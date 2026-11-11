import { NextResponse, type NextRequest } from 'next/server';
import { chavePortal, conferirAcessoPortal, destinoPortal } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const erro = (msg: string, status = 403) =>
  new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campia</title>` +
      `<body style="font:16px system-ui,sans-serif;padding:32px;color:#334">${msg} Volte à área do cliente e abra a Campia de novo.</body>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );

// Entrada pela área do cliente da MS Soluções: confere o acesso assinado, abre a sessão e segue para o painel (ou o /admin).
// Quem ativou a verificação em duas etapas na Campia ainda digita o código da Campia (o middleware cuida disso).
export async function POST(request: NextRequest) {
  const emissor = process.env.PORTAL_URL || 'https://mssolucoestech.com.br';
  const form = await request.formData().catch(() => null);
  const acesso = conferirAcessoPortal(String(form?.get('token') ?? ''), { chave: chavePortal(), emissor });
  if (!acesso) return erro('Acesso inválido ou vencido.');

  const admin = createAdminClient();
  // Cada acesso vale uma vez só.
  const { error: repetido } = await admin
    .from('portal_acessos_usados')
    .insert({ jti: acesso.jti, expira_em: new Date(acesso.exp * 1000).toISOString() });
  if (repetido) return erro('Este acesso já foi usado.');
  await admin.from('portal_acessos_usados').delete().lt('expira_em', new Date(Date.now() - 86_400_000).toISOString());

  // Quem já tem conta entra pelo link mágico; quem ainda não tem (ex.: teste liberado no portal) ganha a conta agora.
  let tipo: 'magiclink' | 'invite' = 'magiclink';
  let { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: acesso.email });
  if (!link?.properties?.hashed_token) {
    tipo = 'invite';
    ({ data: link } = await admin.auth.admin.generateLink({ type: 'invite', email: acesso.email, options: { data: acesso.nome ? { name: acesso.nome } : undefined } }));
  }
  const hash = link?.properties?.hashed_token;
  if (!hash) return erro('Não foi possível entrar com este e-mail na Campia.');

  const supabase = await createClient();
  const { error: falhaSessao } = await supabase.auth.verifyOtp({ token_hash: hash, type: tipo });
  if (falhaSessao) return erro('Não foi possível abrir a sessão.');

  // O /admin continua conferindo o e-mail em ADMIN_EMAILS e pedindo o 2FA da Campia.
  return NextResponse.redirect(new URL(destinoPortal(acesso), request.url), 303);
}
