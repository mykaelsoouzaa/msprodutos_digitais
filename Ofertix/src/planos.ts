// Planos provisórios (preços a validar). Os limites são conferidos no servidor.
export interface Plano {
  id: string;
  nome: string;
  precoCentavos: number;
  numeros: number;          // números de WhatsApp conectados
  gruposEnvio: number;      // grupos com envio ligado
  gruposMonitorados: number;// grupos de onde captura ofertas
  enviosDia: number;        // mensagens por número por dia
  captura: boolean;
  comissoes: boolean;
}

export const PLANOS: Record<string, Plano> = {
  teste:   { id: 'teste',   nome: 'Teste grátis', precoCentavos: 0,     numeros: 1, gruposEnvio: 3,  gruposMonitorados: 2,  enviosDia: 100,  captura: true,  comissoes: true },
  inicial: { id: 'inicial', nome: 'Inicial',      precoCentavos: 4700,  numeros: 1, gruposEnvio: 5,  gruposMonitorados: 3,  enviosDia: 300,  captura: false, comissoes: true },
  pro:     { id: 'pro',     nome: 'Pro',          precoCentavos: 9700,  numeros: 2, gruposEnvio: 15, gruposMonitorados: 10, enviosDia: 800,  captura: true,  comissoes: true },
  escala:  { id: 'escala',  nome: 'Escala',       precoCentavos: 19700, numeros: 4, gruposEnvio: 40, gruposMonitorados: 30, enviosDia: 1500, captura: true,  comissoes: true },
};

export const plano = (id: string | null | undefined): Plano => PLANOS[id ?? ''] ?? PLANOS.teste;
