// Cobrança PIX. Em desenvolvimento usa o provedor simulado; em produção, a Asaas.
import { paymentProvider } from '../env';
import { createAsaasCardCharge, createAsaasPixCharge, refundAsaasInstallment, refundAsaasPayment } from './asaas';

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

/** Devolve um pagamento (PIX ou cartão). No modo de teste (mock) não há dinheiro, então só confirma. */
export async function refundPix(provider: 'mock' | 'asaas', providerId: string | null, installmentId?: string | null): Promise<void> {
  if (provider !== 'asaas') return;
  if (installmentId) return refundAsaasInstallment(installmentId);
  if (!providerId) throw new Error('Cobrança sem identificador no Asaas');
  await refundAsaasPayment(providerId);
}

/** Cobrança no cartão: devolve o link da página de pagamento. No modo de teste, a página da Campia simula. */
export async function createCardCharge(input: PixChargeInput & { installments: number }) {
  if (paymentProvider() === 'asaas') return createAsaasCardCharge(input);
  return { providerId: `mock_${input.paymentId}`, invoiceUrl: null as string | null, installmentId: null as string | null, splitApplied: !!input.split };
}
