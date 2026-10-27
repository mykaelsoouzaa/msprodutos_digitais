// Cobrança PIX. Em desenvolvimento usa o provedor simulado; em produção, a Asaas.
import { paymentProvider } from '../env';
import { createAsaasPixCharge, refundAsaasPayment } from './asaas';

export interface PixChargeInput {
  paymentId: string;      // nosso id, enviado como externalReference
  amountCents: number;
  description: string;
  payerName: string;
  payerPhone: string;
  payerCpfCnpj?: string;  // exigido pela Asaas para criar o cliente
  /** Repasse automático: parte do valor líquido que vai direto para a conta Asaas do organizador. */
  split?: { walletId: string; percent: number };
}

export interface PixCharge {
  providerId: string;
  payload: string;            // PIX copia e cola
  imageBase64: string | null; // QR code em PNG (base64), quando o provedor envia
  expiresAt: string | null;
  /** O split foi aceito pelo provedor (senão o repasse fica manual). */
  splitApplied: boolean;
}

export async function createPixCharge(input: PixChargeInput): Promise<PixCharge> {
  if (paymentProvider() === 'asaas') return createAsaasPixCharge(input);
  return {
    providerId: `mock_${input.paymentId}`,
    payload: `00020126580014BR.GOV.BCB.PIX-SIMULADO-${input.paymentId.slice(0, 8)}-${input.amountCents}`,
    imageBase64: null,
    expiresAt: null,
    splitApplied: !!input.split,
  };
}

/** Devolve um PIX pago. No modo de teste (mock) não há dinheiro, então só confirma. */
export async function refundPix(provider: 'mock' | 'asaas', providerId: string | null): Promise<void> {
  if (provider !== 'asaas') return;
  if (!providerId) throw new Error('Cobrança sem identificador no Asaas');
  await refundAsaasPayment(providerId);
}
