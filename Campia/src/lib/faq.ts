// Perguntas frequentes (página /ajuda e dados estruturados FAQPage para o Google).
import { brl } from './format';
import { campiaFeePercent } from './payout';
import { proFeePercent, proPriceCents } from './plan';

export interface Faq { q: string; a: string }
export interface FaqGroup { title: string; items: Faq[] }

export function faqGroups(): FaqGroup[] {
  const fee = campiaFeePercent(), proFee = proFeePercent(), pro = brl(proPriceCents());
  return [
    {
      title: 'Para quem organiza',
      items: [
        { q: 'Quanto custa usar a Campia?', a: `Criar o campeonato, gerar a tabela e lançar resultados é grátis. Quando os times pagam a inscrição pela Campia, ficam ${fee}% do valor para a plataforma (no Plano Pro, ${proFee}%). Campeonato com inscrição grátis não paga nada.` },
        { q: 'Como recebo o dinheiro das inscrições?', a: 'Em Painel › Recebimentos, cadastre o Wallet ID da sua conta Asaas (é grátis abrir). Cada inscrição paga é dividida na hora: a sua parte cai direto na sua conta, sem cobrar time por time. Sem conta Asaas, a Campia transfere para você depois.' },
        { q: 'Quais esportes dá para organizar?', a: 'Futebol (society, futsal, campo e areia), basquete, handebol, vôlei, vôlei de praia, futevôlei, beach tennis, tênis, padel, pickleball, badminton, tênis de mesa, sinuca, truco, dominó, xadrez e e-sports (EA FC, CS2, Valorant, League of Legends e Rocket League). Cada um com o placar certo: gols, pontos, sets, partidas ou mapas.' },
        { q: 'Posso ter ajudantes para lançar os resultados?', a: 'Sim. Em Ajustes, adicione o e-mail de quem vai ajudar. O ajudante entra com esse e-mail e pode lançar resultados, o placar ao vivo e a presença, e ajustar data, horário e campo dos jogos. Inscrições, dinheiro e ajustes do campeonato continuam só com você.' },
        { q: 'Choveu e o jogo não aconteceu. E agora?', a: 'Abra o jogo no painel e mude a data, ou use "Remarcar uma rodada inteira" na aba Jogos para adiar todos os jogos da rodada de uma vez. Quem segue o campeonato vê a data nova na hora.' },
        { q: 'Como divulgo o campeonato?', a: 'Na aba Compartilhar do painel há link de inscrição, cartaz com QR code para imprimir, artes para stories, textos prontos para o grupo do WhatsApp e o modo TV para deixar na arena.' },
        { q: `O que o Plano Pro tem a mais?`, a: `Por ${pro} por mês: taxa menor (${proFee}%), página sem a marca da Campia, patrocinadores com logo, estatísticas de visitas e planilhas. Dá para cancelar quando quiser.` },
      ],
    },
    {
      title: 'Para capitães e atletas',
      items: [
        { q: 'Como inscrevo o meu time?', a: 'Abra o link de inscrição que o organizador mandou, preencha o nome do time, o contato do capitão e os atletas, e pague. No PIX a vaga fica reservada por 30 minutos e é confirmada sozinha assim que o pagamento cai.' },
        { q: 'Preciso criar conta ou baixar aplicativo?', a: 'Não. Tudo funciona no navegador. Para acompanhar os seus times em Meus times, é só entrar com o e-mail do capitão: chega um link e pronto, sem senha. Se quiser, dá para instalar o site como app no celular.' },
        { q: 'Como recebo os lembretes dos jogos?', a: 'Na página do campeonato, ative os "Lembretes dos jogos" e escolha o seu time. O celular avisa 1 dia e 1 hora antes de cada jogo e quando sai o resultado. Também dá para colocar os jogos na agenda do celular.' },
        { q: 'Já joguei um campeonato. Preciso digitar o time de novo?', a: 'Não. Entre com o e-mail do capitão antes de abrir a inscrição: o formulário vem preenchido com o nome, a sigla, o contato e os atletas do seu último time. É só conferir.' },
        { q: 'Como apareço no ranking e no meu perfil de atleta?', a: 'Na aba Times do campeonato, toque em "Sou eu" ao lado do seu nome. Depois que o capitão ou o organizador aprovar, os seus gols e prêmios entram no seu perfil de atleta.' },
        { q: 'Posso pagar no cartão?', a: 'Se o organizador liberar, sim: à vista ou parcelado, na página segura do Asaas. A Campia não vê o número do cartão.' },
        { q: 'E se o campeonato for cancelado?', a: 'O organizador pode cancelar a inscrição e devolver o valor pelo próprio painel. No PIX, o dinheiro volta para a conta que pagou.' },
      ],
    },
  ];
}

export function faqJsonLd(groups: FaqGroup[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap(g => g.items).map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
}
