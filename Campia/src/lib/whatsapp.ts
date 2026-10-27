// WhatsApp oficial (API do WhatsApp Cloud, da Meta). Desligado até configurar WHATSAPP_TOKEN e WHATSAPP_PHONE_ID.
// Só mensagens de modelo (template) aprovadas pela Meta podem ser enviadas por iniciativa da empresa.
import { onlyDigits } from './format';

export const WA_TEMPLATES = {
  jogo: () => process.env.WHATSAPP_TEMPLATE_JOGO || 'campia_lembrete_jogo',
  pix: () => process.env.WHATSAPP_TEMPLATE_PIX || 'campia_pagamento_pendente',
};

export const whatsappEnabled = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

/** Telefone com DDD → formato internacional do Brasil (55 + DDD + número). */
export function waNumber(phone: string): string | null {
  const d = onlyDigits(phone);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

/** Corpo da chamada à API (modelo com variáveis {{1}}, {{2}}... no texto). */
export function templatePayload(to: string, template: string, params: string[]) {
  return {
    messaging_product: 'whatsapp', to, type: 'template',
    template: {
      name: template, language: { code: 'pt_BR' },
      components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: text.replace(/\s+/g, ' ').slice(0, 300) })) }],
    },
  };
}

export async function sendWhatsapp(phone: string, template: string, params: string[]): Promise<'ok' | 'skipped' | string> {
  if (!whatsappEnabled()) return 'skipped';
  const to = waNumber(phone);
  if (!to) return 'skipped';
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(templatePayload(to, template, params)),
    cache: 'no-store',
  }).catch(() => null);
  if (res?.ok) return 'ok';
  const body = await res?.json().catch(() => null) as { error?: { message?: string } } | null;
  return `WhatsApp respondeu ${res?.status ?? 'sem resposta'}: ${body?.error?.message ?? ''}`.slice(0, 300);
}
