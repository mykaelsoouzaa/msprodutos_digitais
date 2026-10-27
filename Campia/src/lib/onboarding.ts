// Primeiros passos do organizador novo, calculados a partir do que ele já fez.

export interface OnboardingState {
  hasArena: boolean;
  hasPayout: boolean;
  championships: number;
  signedTeams: number;   // times inscritos (pagos) em qualquer campeonato dele
  results: number;       // jogos com resultado lançado
  firstChampionshipId?: string;
}

export interface Step { key: string; title: string; text: string; done: boolean; href: string; cta: string }

export function onboardingSteps(s: OnboardingState): Step[] {
  const champ = s.firstChampionshipId ? `/painel/${s.firstChampionshipId}` : '/painel/novo';
  return [
    { key: 'campeonato', title: 'Crie o primeiro campeonato', text: 'Escolha o esporte, o formato e o valor da inscrição. A tabela sai pronta.', done: s.championships > 0, href: '/painel/novo', cta: 'Criar campeonato' },
    { key: 'arena', title: 'Monte a página da sua arena', text: 'Logo, endereço, WhatsApp e todos os seus campeonatos num link só, para pôr no Instagram.', done: s.hasArena, href: '/painel/arena', cta: 'Criar página' },
    { key: 'recebimento', title: 'Conecte sua conta para receber', text: 'Com a conta Asaas conectada, a sua parte de cada PIX cai direto na sua conta.', done: s.hasPayout, href: '/painel/recebimentos', cta: 'Conectar' },
    { key: 'divulgar', title: 'Mande o link de inscrição no grupo', text: 'Os capitães se inscrevem e pagam sozinhos. Você só acompanha as vagas enchendo.', done: s.signedTeams > 0, href: `${champ}?aba=times`, cta: 'Pegar o link' },
    { key: 'resultado', title: 'Lance o primeiro resultado', text: 'No dia do jogo, toque no jogo e lance o placar pelo celular. A tabela se atualiza sozinha.', done: s.results > 0, href: `${champ}?aba=jogos`, cta: 'Ver jogos' },
  ];
}

export function progress(steps: Step[]) {
  const done = steps.filter(s => s.done).length;
  return { done, total: steps.length, complete: done === steps.length, next: steps.find(s => !s.done) ?? null };
}
