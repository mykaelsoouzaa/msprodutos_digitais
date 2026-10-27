// Versão exibida no rodapé, na tela de abertura e na página de Novidades.
// Ao lançar uma atualização: suba APP_VERSION (igual ao package.json) e adicione um item no topo de CHANGELOG.

export const APP_VERSION = '2.4.0';

export interface Release {
  version: string;
  date: string; // AAAA-MM-DD
  title: string;
  items: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '2.4.0',
    date: '2026-10-27',
    title: 'Indique uma arena',
    items: [
      "Em Plano Pro, cada organizador tem um link de indicação para mandar a outras arenas",
      "Quando a arena indicada assina o Pro, quem indicou ganha 1 mês de Pro de presente, quantas vezes indicar",
    ],
  },
  {
    version: '2.3.1',
    date: '2026-10-27',
    title: 'Ajustes',
    items: [
      "A Campia agora aparece como um produto da MS Soluções Tecnológicas",
      "Perfil do atleta e ranking da arena abrem mais rápido",
    ],
  },
  {
    version: '2.3.0',
    date: '2026-10-27',
    title: 'Alertas e saúde do sistema',
    items: [
      "O dono da Campia recebe um e-mail na hora se o PIX, o webhook do Asaas, o agendador, uma devolução ou o envio de e-mails falhar",
      "Novo quadro de saúde no /admin mostra o que está funcionando, o que precisa de atenção e se falta alguma configuração",
    ],
  },
  {
    version: '2.2.0',
    date: '2026-10-27',
    title: 'Primeiros passos',
    items: [
      "Quem começa na Campia vê no painel um passo a passo: campeonato, página da arena, conta para receber, divulgar e lançar o primeiro resultado",
      "Cada passo se marca sozinho quando é feito, e dá para esconder a lista",
    ],
  },
  {
    version: '2.1.0',
    date: '2026-10-27',
    title: 'Campeonato de exemplo',
    items: [
      "Nova página de exemplo com um campeonato completo: jogos, tabela, placar ao vivo, artilharia, votação e patrocinadores",
      "Link Ver um exemplo na página inicial e em Para arenas, para mostrar a Campia sem precisar criar conta",
    ],
  },
  {
    version: '2.0.0',
    date: '2026-10-27',
    title: 'Plano Pro',
    items: [
      "Novo Plano Pro para arenas e organizadores, com mensalidade e taxa menor por inscrição",
      "No Pro: sem a marca Campia, patrocinadores, estatísticas de visitas e planilhas",
      "Assine e cancele pelo painel; a cobrança mensal vem pelo Asaas, por PIX, boleto ou cartão",
      "Página Para arenas mostra os planos Grátis e Pro lado a lado",
    ],
  },
  {
    version: '1.30.0',
    date: '2026-10-27',
    title: 'Procuro time',
    items: [
      "Atleta sem time coloca o nome na lista Procuram time, na aba Times do campeonato",
      "Os capitães do campeonato e o organizador veem o WhatsApp e chamam com um toque",
      "Para o resto do público aparecem só nome, posição e recado",
    ],
  },
  {
    version: '1.29.0',
    date: '2026-10-27',
    title: 'Ranking da arena',
    items: [
      "Nova aba Ranking na página da arena: times mais vencedores, campeões de cada campeonato e craques eleitos",
      "Artilheiros de todos os campeonatos da arena somados, por esporte",
      "Atleta com perfil aparece com link para a página dele",
    ],
  },
  {
    version: '1.28.0',
    date: '2026-10-27',
    title: 'Perfil do atleta',
    items: [
      "Cada atleta pode ter sua página com gols, jogos, títulos e prêmios de todos os campeonatos na Campia",
      "Nova aba Times na página do campeonato, com o elenco de cada time",
      "O atleta toca em Sou eu no próprio nome e o capitão confirma em Meus times (capitão que se marca entra direto)",
      "Perfil pronto para compartilhar no WhatsApp",
    ],
  },
  {
    version: '1.27.0',
    date: '2026-10-27',
    title: 'Presença no dia do jogo',
    items: [
      "Na tela do jogo, o mesário marca quem chegou de cada time, direto pelo celular",
      "Atleta suspenso aparece em destaque e o sistema avisa se ele for marcado como presente",
      "Ajuda a decidir W.O. e a conferir que só joga quem está inscrito",
    ],
  },
  {
    version: '1.26.0',
    date: '2026-10-27',
    title: 'Patrocinadores',
    items: [
      "Cadastre patrocinadores do campeonato em Ajustes, com logo e link para o site ou Instagram",
      "Cota master aparece em destaque e cota de apoio menor, na página do campeonato, na versão para imprimir e nas artes dos stories",
      "Ajuda a vender patrocínio para bancar a premiação",
    ],
  },
  {
    version: '1.25.0',
    date: '2026-10-27',
    title: 'Baixar planilhas',
    items: [
      "Na aba Times e inscrições: baixe planilhas de times e contatos, atletas, pagamentos e jogos",
      "Abrem direto no Excel e no Google Planilhas, com acentos e valores em reais",
    ],
  },
  {
    version: '1.24.0',
    date: '2026-10-27',
    title: 'Nova edição em um clique',
    items: [
      "Botão Nova edição no painel: cria o próximo campeonato com o mesmo formato, valor, local, horários e regras",
      "O nome já vem sugerido (Copa 2026 vira Copa 2027)",
      "Opção de avisar por e-mail os capitães da edição anterior que as inscrições abriram",
    ],
  },
  {
    version: '1.23.0',
    date: '2026-10-27',
    title: 'Estatísticas de visitas',
    items: [
      "Nova aba Visitas no painel: quantas pessoas abriram a página do campeonato por dia",
      "Mostra de onde vieram (WhatsApp, Instagram, Google...) e quantas foram para a inscrição",
      "Os links de Divulgar já saem marcados, para você saber quanto o WhatsApp trouxe",
      "Sem dado pessoal: só a contagem e a origem geral; suas próprias visitas não contam",
    ],
  },
  {
    version: '1.22.0',
    date: '2026-10-27',
    title: 'Mais fácil de achar no Google',
    items: [
      "Os campeonatos públicos e as páginas das arenas aparecem melhor no Google, com datas, local e preço da inscrição",
      "O Google recebe a lista de páginas do site e deixa de lado as áreas privadas (painel e pagamento)",
      "Descrição do campeonato nas buscas agora mostra o esporte e a cidade",
    ],
  },
  {
    version: '1.21.0',
    date: '2026-10-27',
    title: 'Craque do campeonato',
    items: [
      "Atletas e torcedores votam no craque, no melhor goleiro e na revelação, direto na página do campeonato",
      "Um voto por pessoa em cada categoria (precisa entrar com o e-mail); dá para mudar o voto enquanto estiver aberta",
      "O organizador abre e encerra a votação em Ajustes e acompanha o resultado parcial",
      "Quando encerra, o resultado aparece com medalhas e sai uma arte pronta para os stories",
    ],
  },
  {
    version: '1.20.0',
    date: '2026-10-26',
    title: 'Placar ao vivo',
    items: [
      "Na tela do jogo, toque em Começar ao vivo e vá somando os pontos com +1 e −1 pelo celular (o ajudante também pode).",
      "A página do campeonato mostra Ao vivo agora com o placar, que se atualiza sozinho a cada 15 segundos.",
      "No fim, o placar ao vivo já vem preenchido para salvar o resultado.",
    ],
  },
  {
    version: '1.19.0',
    date: '2026-10-26',
    title: 'Lotes de preço e cupom de desconto',
    items: [
      "Defina até 3 lotes com valores mais baratos para quem se inscreve antes; a página mostra o lote atual e o próximo preço.",
      "Crie cupons de desconto (em % ou em R$) com limite de usos; o capitão digita o código na inscrição.",
      "O valor recebido no painel passa a somar exatamente o que foi pago pelo PIX.",
    ],
  },
  {
    version: '1.18.0',
    date: '2026-10-26',
    title: 'Lista de espera',
    items: [
      "Quando as vagas acabam, a página de inscrição vira uma lista de espera.",
      "Se abrir vaga (desistência ou PIX não pago), a Campia avisa por e-mail os primeiros da fila, na ordem de chegada.",
      "O organizador vê a fila na aba Times, pode chamar pelo WhatsApp e remover.",
    ],
  },
  {
    version: '1.17.0',
    date: '2026-10-26',
    title: 'Sorteio dos grupos e dos confrontos',
    items: [
      "Na aba Times, o botão Sortear agora distribui os times nos grupos (ou monta a chave do mata-mata) por sorteio, em vez da ordem de inscrição.",
      "Dá para sortear de novo até o primeiro resultado, e a página do campeonato mostra quando o sorteio foi feito.",
    ],
  },
  {
    version: '1.16.0',
    date: '2026-10-26',
    title: 'Prévia bonita no WhatsApp',
    items: [
      "Ao colar o link de um campeonato no WhatsApp ou no Instagram, aparece uma imagem com o nome, o esporte, a situação, as vagas, o valor e o local.",
      "A página da arena e a página inicial também ganharam imagem de prévia.",
    ],
  },
  {
    version: '1.15.0',
    date: '2026-10-26',
    title: 'Lembrete do PIX pendente',
    items: [
      "Quem reservou a vaga e ainda não pagou recebe um e-mail com o link do PIX, cerca de 10 minutos depois da inscrição.",
      "O lembrete sai uma vez só e só quando ainda dá tempo de pagar antes de a vaga expirar.",
    ],
  },
  {
    version: '1.14.0',
    date: '2026-10-26',
    title: 'Imprimir ou salvar em PDF',
    items: [
      "Nova página de impressão com classificação, chaveamento, todos os jogos, artilharia e cartões, em fundo branco.",
      "Botão Imprimir / PDF na página do campeonato e na aba Compartilhar do painel.",
    ],
  },
  {
    version: '1.13.0',
    date: '2026-10-26',
    title: 'Página Para arenas',
    items: [
      "Nova página Para arenas, explicando o que a Campia faz, como o dinheiro chega ao organizador, como começar e as perguntas frequentes.",
      "Link Para arenas no menu e botão Sou arena ou organizador na página inicial.",
    ],
  },
  {
    version: '1.12.0',
    date: '2026-10-26',
    title: 'Cancelar inscrição e devolver o PIX',
    items: [
      "O organizador cancela uma inscrição pela tela de edição do time: a vaga volta a ficar livre e o PIX pode ser devolvido pelo Asaas na hora.",
      "PIX pagos depois de a vaga expirar aparecem na aba Times com o botão Devolver PIX.",
      "Em Recebimentos, inscrições devolvidas aparecem como Devolvido.",
    ],
  },
  {
    version: '1.11.0',
    date: '2026-10-26',
    title: 'Gestão dos repasses',
    items: [
      "Controle interno dos repasses aos organizadores: cada inscrição paga com repasse manual é acompanhada até ser transferida.",
    ],
  },
  {
    version: '1.10.0',
    date: '2026-10-26',
    title: 'Termos de Uso e Política de Privacidade',
    items: [
      "Novas páginas de Termos de Uso e Política de Privacidade, de acordo com a LGPD, com links no rodapé.",
      "A inscrição pede o aceite dos Termos e da Privacidade; o login também mostra os links.",
    ],
  },
  {
    version: '1.9.0',
    date: '2026-10-26',
    title: 'Editar campeonato, times e atletas',
    items: [
      "Na aba Ajustes: mude o nome e o valor da inscrição e refaça a agenda dos jogos que ainda não aconteceram.",
      "Enquanto ninguém se inscreveu, dá para trocar o formato e o número de times.",
      "Na aba Times: edite o nome do time, os dados do capitão e a lista de atletas.",
      "Inscreva um time manualmente numa vaga livre (pagamento por fora ou cortesia).",
    ],
  },
  {
    version: '1.8.2',
    date: '2026-10-26',
    title: 'Aviso ao conectar a conta errada',
    items: [
      "Em Recebimentos, a Campia avisa se o Wallet ID informado for da própria conta da Campia, que o Asaas não aceita para repasse.",
    ],
  },
  {
    version: '1.8.1',
    date: '2026-10-26',
    title: 'Conectar o repasse só com o Wallet ID',
    items: [
      "Em Recebimentos, o organizador conecta a conta Asaas colando apenas o Wallet ID, sem precisar de chave de API.",
      "Mais simples e mais seguro: o Wallet ID só identifica a conta que recebe.",
    ],
  },
  {
    version: '1.8.0',
    date: '2026-10-26',
    title: 'Repasse automático do PIX',
    items: [
      "Nova página Recebimentos no painel: o organizador conecta a conta Asaas dele e cada inscrição paga já cai dividida, direto na conta dele.",
      "Para conectar basta colar a chave de API do Asaas uma vez; a Campia descobre o Wallet ID e não guarda a chave.",
      "Lista das últimas inscrições com o status do pagamento e se o repasse foi automático ou manual.",
      "Se o Asaas recusar a divisão, a inscrição continua funcionando e aquele repasse fica manual.",
    ],
  },
  {
    version: '1.7.0',
    date: '2026-10-26',
    title: 'W.O. e cartões',
    items: [
      "Marque W.O. no resultado: o time presente vence com o placar padrão do esporte (3 × 0 no futebol) e o ausente não pontua.",
      "W.O. duplo nos pontos corridos e na fase de grupos: derrota sem pontos para os dois.",
      "Cartões amarelo e vermelho por atleta no futebol, futsal e handebol.",
      "Suspensão automática no próximo jogo após vermelho, 2 amarelos no jogo ou amarelos acumulados (o organizador escolhe quantos).",
      "Nova aba Cartões com os suspensos da próxima rodada; o formulário avisa quem está suspenso.",
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-26',
    title: 'Ajudantes do organizador',
    items: [
      "Convide ajudantes por e-mail na aba Ajustes do campeonato.",
      "Ajudantes lançam resultados e ajustam data, horário e campo, sem ver pagamentos, contatos ou ajustes.",
      "Botão para enviar o convite pelo WhatsApp; o campeonato aparece no painel do ajudante em Você ajuda em.",
    ],
  },
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
