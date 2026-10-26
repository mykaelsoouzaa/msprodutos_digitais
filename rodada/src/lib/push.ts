import webpush from 'web-push';

let configured = false;

/** Envia uma notificação. Retorna 'gone' quando o aparelho cancelou a inscrição (apagar do banco). */
export async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<'ok' | 'gone' | 'error'> {
  if (!configured) {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) throw new Error('Chaves VAPID não configuradas');
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@exemplo.com', pub, priv);
    configured = true;
  }
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 });
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? 'gone' : 'error';
  }
}
