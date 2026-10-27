import type { Metadata } from 'next';
import Link from 'next/link';
import SportIcon from '@/components/SportIcon';
import { COMPANY } from '@/lib/company';
import { SPORT_GROUPS, sportsIn } from '@/lib/domain/sports';
import { brl } from '@/lib/format';
import { campiaFeePercent, organizerPercent } from '@/lib/payout';
import { PRO_FEATURES, proFeePercent, proPriceCents } from '@/lib/plan';

export const metadata: Metadata = {
  alternates: { canonical: '/para-arenas' },
  title: 'Para arenas e organizadores',
  description: 'Campeonato lotado e pago antes do primeiro jogo: inscrição com PIX, tabela automática, página da arena e repasse direto na sua conta.',
};

const BENEFITS: Array<[string, string, string]> = [
  ['💸', 'Inscrição paga pelo PIX', 'Cada capitão inscreve o time pelo link e paga na hora. A vaga só é confirmada com o PIX pago: acabou o "depois eu te passo".'],
  ['📅', 'Tabela e agenda prontas', 'Pontos corridos, grupos + mata-mata ou mata-mata. Jogos, horários e campos saem em segundos.'],
  ['📊', 'Classificação ao vivo', 'Lance o placar pelo celular e a tabela, o chaveamento, a artilharia e os cartões se atualizam sozinhos.'],
  ['🏟️', 'Página da sua arena', 'Um endereço próprio com logo, endereço, WhatsApp e todos os seus campeonatos, para divulgar no Instagram.'],
  ['📲', 'Tudo no WhatsApp', 'Link de inscrição, arte da rodada para os stories e lembretes de jogo no celular dos atletas.'],
  ['🤝', 'Ajudantes e mesários', 'Convide quem lança os resultados no dia, sem dar acesso ao dinheiro.'],
];

const FAQ: Array<[string, string]> = [
  ['Tem mensalidade?', 'No plano grátis, não: você só paga a taxa de serviço sobre cada inscrição paga pela plataforma. Campeonato sem inscrição paga não custa nada. O Pro tem mensalidade fixa e taxa menor, e você cancela quando quiser.'],
  ['Como o dinheiro chega até mim?', 'Você cria uma conta grátis no Asaas (banco digital, com CPF ou CNPJ) e conecta na Campia. Cada PIX de inscrição já cai dividido: a sua parte vai direto para a sua conta, e você saca quando quiser.'],
  ['E se um time desistir?', 'Pelo painel você cancela a inscrição, libera a vaga para outro time e devolve o PIX na hora, se quiser.'],
  ['Os atletas precisam baixar algum app?', 'Não. Tudo funciona pelo navegador do celular. Quem quiser pode instalar a Campia na tela inicial e receber lembretes dos jogos.'],
  ['Serve para quais esportes?', 'Society, futsal, campo, vôlei, vôlei de praia, futevôlei, beach tennis, tênis, padel, basquete, handebol, tênis de mesa e e-sports, cada um com o placar certo.'],
  ['Preciso entender de tecnologia?', 'Não. Se você usa WhatsApp, usa a Campia. O campeonato fica pronto em 2 minutos.'],
];

export default function ParaArenas() {
  const fee = campiaFeePercent();
  const yours = organizerPercent(fee);
  const example = { teams: 8, fee: 30000 };
  const gross = example.teams * example.fee;

  return (
    <>
      <section className="home-hero">
        <div>
          <span className="eyebrow">Para arenas, quadras e organizadores</span>
          <h1 className="title-xl">Campeonato lotado e pago antes do primeiro jogo</h1>
          <p className="lead">A Campia cuida da inscrição com PIX, da tabela, dos resultados e da divulgação. Você cuida do jogo.</p>
          <div className="ctas">
            <Link href="/entrar?voltar=/painel/arena" className="btn lg">Criar minha conta grátis</Link>
            <a href={`mailto:${COMPANY.email}?subject=${encodeURIComponent('Quero usar a Campia na minha arena')}`} className="btn ghost lg">Falar com a gente</a>
          </div>
          <p className="fine">Sem mensalidade. Sem contrato de fidelidade.</p>
        </div>
        <div className="mock money-mock" aria-hidden="true">
          <div className="mock-head"><span className="sport-ico g-futebol" style={{ fontSize: 18 }}>💰</span><div className="grow"><b>Copa da sua arena</b><span>{example.teams} times · {brl(example.fee)} por time</span></div></div>
          <div className="money-row"><span>Inscrições pagas</span><b>{brl(gross)}</b></div>
          <div className="money-row"><span>Vai direto para a sua conta</span><b className="money">{yours}% do líquido</b></div>
          <div className="money-row"><span>Taxa da Campia</span><b>{fee}%</b></div>
          <div className="money-row"><span>Mensalidade</span><b>R$ 0,00</b></div>
          <p className="sub small" style={{ margin: '10px 0 0' }}>Líquido = valor pago menos a tarifa do Asaas por PIX.</p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">O que a Campia faz por você</h2>
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          {BENEFITS.map(([icon, t, d]) => (
            <div className="card benefit" key={t}>
              <span className="benefit-ico" aria-hidden="true">{icon}</span>
              <b>{t}</b>
              <p className="sub" style={{ margin: '4px 0 0' }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Como começar</h2>
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          {[
            ['Crie a conta e a página da arena', 'Entre com o seu e-mail e coloque o logo, o endereço e o WhatsApp.'],
            ['Conecte a sua conta Asaas', 'Cole o seu Wallet ID em Recebimentos. As inscrições passam a cair direto na sua conta.'],
            ['Crie o campeonato e mande o link', 'Escolha o esporte e o formato, defina o valor e mande o link no grupo dos capitães.'],
          ].map(([t, d], i) => (
            <div className="card step" key={t}><span className="n">{i + 1}</span><div><b>{t}</b><p className="sub" style={{ margin: 0 }}>{d}</p></div></div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Planos</h2>
        <div className="plans-grid" style={{ marginTop: 14 }}>
          <div className="card plan-card">
            <span className="badge open">Grátis</span>
            <div className="plan-price">R$ 0<span>/mês</span></div>
            <ul className="plan-list">
              <li><span>💸</span><span>Taxa de {fee}% por inscrição paga</span></li>
              <li><span>📅</span><span>Tabela, agenda, placar ao vivo, artes e página da arena</span></li>
              <li><span>🏅</span><span>Votação do craque, lista de espera, cupons e lotes</span></li>
            </ul>
            <div className="actions"><Link href="/entrar?voltar=/painel" className="btn ghost">Começar grátis</Link></div>
          </div>
          <div className="card plan-card on">
            <span className="badge pro">Pro</span>
            <div className="plan-price">{brl(proPriceCents())}<span>/mês</span></div>
            <ul className="plan-list">
              {PRO_FEATURES.map(([icon, text], i) => <li key={text}><span>{icon}</span><span>{i === 0 ? <>Taxa de só <b>{proFeePercent()}%</b> por inscrição</> : text}</span></li>)}
            </ul>
            <div className="actions"><Link href="/entrar?voltar=/painel/plano" className="btn">Assinar o Pro</Link></div>
          </div>
        </div>
        <p className="sub small" style={{ marginTop: 10 }}>Fazendo as contas: com o Pro, a taxa cai de {fee}% para {proFeePercent()}%. A partir de {brl(Math.ceil(proPriceCents() / Math.max(0.01, (fee - proFeePercent()) / 100)))} de inscrições por mês, o Pro já se paga.</p>
      </section>

      <section className="section">
        <h2 className="section-title">Esportes</h2>
        <div className="sport-chips" style={{ marginTop: 14 }}>
          {SPORT_GROUPS.flatMap(g => sportsIn(g)).map(([key, r]) => <span className="sport-chip" key={key}><SportIcon sport={key} size={16} />{r.label}</span>)}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Perguntas frequentes</h2>
        <div className="faq" style={{ marginTop: 14 }}>
          {FAQ.map(([q, a]) => (
            <details className="card faq-item" key={q}>
              <summary>{q}</summary>
              <p className="sub" style={{ margin: '8px 0 0' }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="final-cta">
          <h2 className="section-title">Bora encher a próxima copa?</h2>
          <p className="sub">Crie a conta, monte o campeonato e mande o link hoje mesmo.</p>
          <div className="ctas" style={{ justifyContent: 'center' }}>
            <Link href="/entrar?voltar=/painel/arena" className="btn lg">Criar minha conta grátis</Link>
            <Link href="/campeonatos" className="btn ghost lg">Ver campeonatos</Link>
          </div>
        </div>
      </section>
    </>
  );
}
