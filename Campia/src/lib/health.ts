// Quadro de saúde do /admin: o que está funcionando e o que precisa de atenção.

export type HealthState = 'ok' | 'atencao' | 'erro';
export interface Check { key: string; label: string; state: HealthState; detail: string }

export const ALERT_EVERY_MIN = 30;

/** Manda alerta por e-mail se o último do mesmo tipo foi há mais de ALERT_EVERY_MIN minutos. */
export const shouldAlert = (lastAlertAt: string | null | undefined, now = Date.now()) =>
  !lastAlertAt || now - Date.parse(lastAlertAt) > ALERT_EVERY_MIN * 60_000;

const ago = (iso: string, now: number) => {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
};

/** Variáveis da Vercel que precisam existir (só confere se existem, nunca mostra o valor). */
export const REQUIRED_ENV: Array<[string, string]> = [
  ['NEXT_PUBLIC_SITE_URL', 'Endereço do site'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'Chave de servidor do Supabase'],
  ['ASAAS_API_KEY', 'Chave do Asaas'],
  ['ASAAS_WEBHOOK_TOKEN', 'Token do webhook do Asaas'],
  ['CRON_SECRET', 'Senha do agendador'],
  ['BREVO_API_KEY', 'Envio de e-mails (Brevo)'],
  ['ADMIN_EMAILS', 'Quem recebe os alertas'],
  ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'Lembretes no celular'],
];

export function healthChecks(i: {
  now: number;
  cronAt: string | null;
  webhookAt: string | null;
  events: Array<{ kind: string; message: string; created_at: string }>;
  env: Record<string, string | undefined>;
  provider: 'mock' | 'asaas';
}): Check[] {
  const recent = (kind: string, hours = 24) => i.events.filter(e => e.kind === kind && i.now - Date.parse(e.created_at) < hours * 3600_000);
  const last = (kind: string) => recent(kind)[0];
  const checks: Check[] = [];

  const cronMin = i.cronAt ? (i.now - Date.parse(i.cronAt)) / 60_000 : Infinity;
  checks.push({
    key: 'agendador', label: 'Agendador (lembretes)',
    state: cronMin <= 25 ? 'ok' : cronMin <= 120 ? 'atencao' : 'erro',
    detail: i.cronAt ? `rodou ${ago(i.cronAt, i.now)}` : 'nunca rodou: confira o pg_cron no Supabase',
  });

  const wh = recent('webhook');
  checks.push({
    key: 'webhook', label: 'Webhook do Asaas',
    state: wh.length ? 'erro' : i.provider !== 'asaas' ? 'atencao' : 'ok',
    detail: wh.length ? `${wh.length} falha(s) em 24 h: ${wh[0].message}`
      : i.provider !== 'asaas' ? 'PIX em modo de teste (PAYMENT_PROVIDER não é asaas)'
      : i.webhookAt ? `último aviso ${ago(i.webhookAt, i.now)}` : 'sem avisos ainda',
  });

  for (const [kind, label] of [['pix', 'Geração de PIX'], ['repasse', 'Repasse automático'], ['estorno', 'Devoluções'], ['email', 'E-mails'], ['agendador-erro', 'Tarefas do agendador']] as const) {
    const n = recent(kind).length;
    checks.push({ key: kind, label, state: n ? (kind === 'repasse' ? 'atencao' : 'erro') : 'ok', detail: n ? `${n} em 24 h: ${last(kind)!.message}` : 'sem falhas em 24 h' });
  }

  const missing = REQUIRED_ENV.filter(([k]) => !i.env[k]).map(([, label]) => label);
  checks.push({ key: 'config', label: 'Configuração na Vercel', state: missing.length ? 'erro' : 'ok', detail: missing.length ? `faltando: ${missing.join(', ')}` : 'tudo configurado' });
  return checks;
}
