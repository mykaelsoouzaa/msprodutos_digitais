// Configuração lida do ambiente (arquivo .env carregado em main.ts).
import { randomBytes } from 'node:crypto';

const env = (k: string, padrao = '') => (process.env[k] ?? padrao).trim();

export interface Config {
  porta: number;
  urlPublica: string;          // https://ofertix.cloud
  arquivoBanco: string;
  segredoSessao: string;
  portalUrl: string;           // emissor do acesso assinado
  portalChavePublica: string;  // PEM (pode vir com \n literal)
  dev: boolean;                // libera /dev-login e usa WhatsApp simulado
  evolutionUrl: string;        // http://127.0.0.1:8080
  evolutionApiKey: string;
  adminEmails: string[];
}

export function lerConfig(): Config {
  const dev = env('OFERTIX_DEV') === '1';
  return {
    porta: Number(env('PORTA', '3200')),
    urlPublica: env('URL_PUBLICA', 'http://localhost:3200').replace(/\/+$/, ''),
    arquivoBanco: env('BANCO', dev ? ':memory:' : './dados/ofertix.db'),
    segredoSessao: env('SEGREDO_SESSAO') || (dev ? randomBytes(32).toString('hex') : ''),
    portalUrl: env('PORTAL_URL', 'https://mssolucoestech.com.br').replace(/\/+$/, ''),
    portalChavePublica: env('PORTAL_CHAVE_PUBLICA').replace(/\\n/g, '\n'),
    dev,
    evolutionUrl: env('EVOLUTION_URL').replace(/\/+$/, ''),
    evolutionApiKey: env('EVOLUTION_API_KEY'),
    adminEmails: env('ADMIN_EMAILS').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean),
  };
}
