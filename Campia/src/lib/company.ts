// Dados da empresa responsável pela Campia (aparecem nos Termos e na Privacidade).
// Preencha o CNPJ em NEXT_PUBLIC_EMPRESA_CNPJ na Vercel para ele aparecer nas páginas.
export const COMPANY = {
  name: 'MS Soluções Tecnológicas',
  cnpj: process.env.NEXT_PUBLIC_EMPRESA_CNPJ || '',
  email: 'contato@campia.app.br',
  site: 'campia.app.br',
};
export const LEGAL_UPDATED = '27/10/2026';
