// Integração com a Asaas (API v3).
// Documentação: https://docs.asaas.com/docs/cobrancas-via-pix
//   1. POST /customers        → cria o pagador (nome + CPF/CNPJ)
//   2. POST /payments         → cria a cobrança com billingType PIX e externalReference = nosso id
//   3. GET  /payments/{id}/pixQrCode → encodedImage (PNG base64), payload (copia e cola), expirationDate
// Autenticação: cabeçalho `access_token`. Contas novas exigem também um User-Agent.
import type { PixCharge, PixChargeInput } from './index';

const base = () => (process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3').replace(/\/$/, '');

async function asaas<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY não configurada');
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'campia', access_token: key, ...(init.headers || {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { errors?: Array<{ description?: string }> }).errors?.[0]?.description || `Asaas respondeu ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function createAsaasPixCharge(input: PixChargeInput): Promise<PixCharge> {
  if (!input.payerCpfCnpj) throw new Error('CPF ou CNPJ do responsável é obrigatório para o PIX');

  const customer = await asaas<{ id: string }>('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: input.payerName, cpfCnpj: input.payerCpfCnpj, mobilePhone: input.payerPhone, notificationDisabled: true }),
  });

  const body = {
    customer: customer.id,
    billingType: 'PIX',
    value: input.amountCents / 100,
    dueDate: today(),
    description: input.description.slice(0, 500),
    externalReference: input.paymentId,
  };
  const create = (split?: PixChargeInput['split']) => asaas<{ id: string }>('/payments', {
    method: 'POST',
    body: JSON.stringify(split ? { ...body, split: [{ walletId: split.walletId, percentualValue: split.percent }] } : body),
  });

  // Com repasse automático: se a Asaas recusar o split (walletId errado, conta bloqueada...),
  // cria a cobrança sem split para a inscrição não travar; o repasse dessa fica manual.
  let payment: { id: string };
  let splitApplied = false;
  if (input.split) {
    try { payment = await create(input.split); splitApplied = true; }
    catch (e) { console.error('Asaas recusou o split; cobrança sem repasse automático', e); payment = await create(); }
  } else {
    payment = await create();
  }

  let qr: { encodedImage: string; payload: string; expirationDate: string };
  try {
    qr = await asaas(`/payments/${payment.id}/pixQrCode`);
  } catch (e) {
    // Sem QR code a inscrição falha: apaga a cobrança na Asaas para não sobrar uma cobrança pagável sem vaga.
    await asaas(`/payments/${payment.id}`, { method: 'DELETE' }).catch(() => {});
    throw e;
  }
  return { providerId: payment.id, payload: qr.payload, imageBase64: qr.encodedImage, expiresAt: qr.expirationDate ?? null, splitApplied };
}

/** Eventos que significam dinheiro recebido. */
export const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
