// E-mails automáticos da Campia pela API do Brevo (os de login continuam saindo pelo Supabase).
// Precisa de BREVO_API_KEY (Brevo › SMTP & API › API Keys). Sem a chave, não envia e não quebra nada.

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function sendEmail(msg: { to: string; name?: string; subject: string; html: string; replyTo?: string }, opts: { log?: boolean } = {}): Promise<'ok' | 'skipped' | 'error'> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return 'skipped';
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Campia', email: process.env.EMAIL_FROM || 'naoresponda@campia.app.br' },
      to: [{ email: msg.to, ...(msg.name ? { name: msg.name } : {}) }],
      subject: msg.subject,
      htmlContent: msg.html,
      ...(msg.replyTo ? { replyTo: { email: msg.replyTo } } : {}),
    }),
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) {
    const detail = `Brevo respondeu ${res?.status ?? 'sem resposta'}: ${(await res?.text().catch(() => '')) ?? ''}`.slice(0, 300);
    console.error('Brevo recusou o e-mail', detail);
    if (opts.log !== false) {
      const { logEvent } = await import('./monitor');
      await logEvent('email', detail, { alert: false });
    }
    return 'error';
  }
  return 'ok';
}
