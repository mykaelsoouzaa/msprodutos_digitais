// Cobrança PIX. Em desenvolvimento usa o provedor simulado; em produção, a Asaas.
import { paymentProvider } from '../env';
import { createAsaasPixCharge } from './asaas';

export interface PixChargeInput {
  paymentId: string;      // nosso id, enviado como externalReference
  amountCents: number;
  description: string;
  payerName: string;
  payerPhone: string;
  payerCpfCnpj?: string;  // exigido pela Asaas para criar o cliente
}

export interface PixCharge {
  providerId: string;
  payload: string;            // PIX copia e cola
  imageBase64: string | null; // QR code em PNG (base64), quando o provedor envia
  expiresAt: string | null;
}

export async function createPixCharge(input: PixChargeInput): Promise<PixCharge> {
  if (paymentProvider() === 'asaas') return createAsaasPixCharge(input);
  return {
    providerId: `mock_${input.paymentId}`,
    payload: `00020126580014BR.GOV.BCB.PIX-SIMULADO-${input.paymentId.slice(0, 8)}-${input.amountCents}`,
    imageBase64: null,
    expiresAt: null,
  };
}
