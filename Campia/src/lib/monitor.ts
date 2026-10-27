// Registro de falhas e alerta por e-mail para o dono da Campia (ADMIN_EMAILS).
// Nunca derruba quem chamou: qualquer erro aqui é engolido.
import { escapeHtml, sendEmail } from './email';
import { siteUrl } from './env';
import { shouldAlert } from './health';
import { createAdminClient } from '@/lib/supabase/admin';

const LABEL: Record<string, string> = {
  webhook: 'webhook do Asaas', pix: 'geração de PIX', repasse: 'repasse automático', estorno: 'devolução de PIX',
  email: 'envio de e-mails', whatsapp: 'WhatsApp', indicacao: 'prêmio de indicação', 'agendador-erro': 'agendador',
};

/** Último sinal de vida de uma parte do sistema (agendador, webhook). */
export async function beat(key: string, info = '') {
  try {
    await createAdminClient().from('system_status').upsert({ key, at: new Date().toISOString(), info: info.slice(0, 300) });
  } catch { /* sem banco atualizado ou sem chave: ignora */ }
}

/** Registra uma falha e, se fizer sentido, avisa por e-mail (no máximo a cada 30 min por tipo). */
export async function logEvent(kind: string, message: string, opts: { alert?: boolean } = {}) {
  console.error(`[campia:${kind}] ${message}`);
  try {
    const db = createAdminClient();
    await db.from('system_events').insert({ kind, message: message.slice(0, 500) });
    const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (opts.alert === false || !admins.length) return;
    const { data: last } = await db.from('system_status').select('at').eq('key', `alerta:${kind}`).maybeSingle<{ at: string }>();
    if (!shouldAlert(last?.at)) return;
    await db.from('system_status').upsert({ key: `alerta:${kind}`, at: new Date().toISOString(), info: message.slice(0, 300) });
    for (const to of admins) {
      await sendEmail({
        to, subject: `[Campia] Falha: ${LABEL[kind] ?? kind}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#111">
<p><b>Algo falhou na Campia:</b> ${escapeHtml(LABEL[kind] ?? kind)}</p>
<p style="background:#f4f4f5;padding:12px;border-radius:8px;font-family:monospace;font-size:13px">${escapeHtml(message)}</p>
<p><a href="${siteUrl()}/admin">Abrir o quadro de saúde no /admin</a></p>
<p style="color:#666;font-size:12px">Novos avisos do mesmo tipo ficam em silêncio por 30 minutos.</p>
</div>`,
      }, { log: false });
    }
  } catch { /* nunca quebra o fluxo principal */ }
}
