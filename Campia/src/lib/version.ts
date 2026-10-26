// Versão exibida no rodapé, na tela de abertura e na página de Novidades.
// Ao lançar uma atualização: suba APP_VERSION (igual ao package.json) e adicione um item no topo de CHANGELOG.

export const APP_VERSION = '1.5.0';

export interface Release {
  version: string;
  date: string; // AAAA-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '1.5.0',
    date: '2026-10-26',
    title: 'Área do capitão: Meus times',
    items: [
      "Nova página Meus times: o capitão entra com o e-mail da inscrição e vê os times dele.",
      "Para cada time: posição na tabela, último resultado, próximos jogos e link para pagar o PIX pendente.",
      "A inscrição agora pede o e-mail do capitão; o organizador pode cadastrar o e-mail de quem se inscreveu antes.",
      "Menu no celular com Campeonatos, Meus times, Como funciona e Novidades.",
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-26',
    title: 'Página da arena',
    items: [
      "Cada organizador pode criar a página da sua arena, com logo, endereço, descrição, WhatsApp e Instagram.",
      "A página mostra os campeonatos atuais e os anteriores, e tem botão de Como chegar.",
      "Os campeonatos mostram quem organiza, com link para a página da arena.",
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-26',
    title: 'Explorar campeonatos',
    items: [
      "Nova página Campeonatos, com todos os campeonatos públicos.",
      "Filtros por estado, cidade, categoria de esporte, presencial ou online e só inscrições abertas.",
      "Campeonatos com inscrições abertas aparecem primeiro, com vagas e valor da inscrição.",
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-26',
    title: 'Cidade, estado e campeonatos online',
    items: [
      'Local do campeonato com cidade e estado (UF) separados, mostrados como "Campinas - SP".',
      'Campeonatos de e-sports podem ser marcados como Online; aí os campos de endereço somem.',
      'O local aparece na página do campeonato, na inscrição, na arte da rodada e na mensagem do WhatsApp.',
      'Dá para mudar o local depois, na aba Ajustes do campeonato.',
    ],
  },
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
