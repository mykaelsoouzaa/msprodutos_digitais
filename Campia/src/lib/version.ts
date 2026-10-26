// Versão exibida no rodapé, na tela de abertura e na página de Novidades.
// Ao lançar uma atualização: suba APP_VERSION (igual ao package.json) e adicione um item no topo de CHANGELOG.

export const APP_VERSION = '1.1.0';

export interface Release {
  version: string;
  date: string; // AAAA-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.1.0',
    date: '2026-10-26',
    title: 'Visual novo para celular, tablet e computador',
    items: [
      'Layout adaptável: no computador, a página do campeonato tem duas colunas e os jogos aparecem em grade.',
      'Ícones próprios para cada esporte, separados por categoria: Futebol, Quadra, Areia, Raquete e Games.',
      'Escolha do esporte em cartões, mais fácil de tocar no celular.',
      'Nova tela de abertura e nova tela de entrada no painel.',
      'Página de Novidades com o histórico das atualizações.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-26',
    title: 'Lançamento da Campia',
    items: [
      'Tabela e agenda automáticas em pontos corridos, grupos + mata-mata ou mata-mata.',
      'Inscrição dos times pelo link, com pagamento por PIX e confirmação automática da vaga.',
      'Resultados pelo celular, com classificação, chaveamento e artilharia.',
      'Página pública do campeonato e arte da rodada para os stories.',
      'App instalável com lembretes antes dos jogos.',
    ],
  },
];
