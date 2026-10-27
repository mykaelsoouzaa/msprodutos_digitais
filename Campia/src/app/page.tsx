import Link from 'next/link';
import SportIcon from '@/components/SportIcon';
import { SPORT_GROUPS, sportsIn } from '@/lib/domain/sports';

const STEPS = [
  ['Crie o campeonato', 'Escolha o esporte e o formato. A tabela e os horários saem prontos.'],
  ['Mande o link no grupo', 'Cada capitão inscreve o time e paga pelo PIX. A vaga é confirmada sozinha.'],
  ['Lance os resultados', 'Classificação, mata-mata e artilharia se atualizam; a arte da rodada sai pronta.'],
];

const PREVIEW: Array<[string, string, number, number, string, string]> = [
  ['Real Várzea', '#2563eb', 3, 1, 'Unidos FC', '#dc2626'],
  ['Galáticos', '#7c3aed', 2, 2, 'Bola Cheia', '#ea580c'],
  ['Amigos do Gol', '#0891b2', 0, 1, 'Resenha EC', '#16a34a'],
];

export default function Home() {
  return (
    <>
      <section className="home-hero">
        <div>
          <span className="eyebrow">Futebol, quadra, areia, raquete e games</span>
          <h1 className="title-xl">Seu campeonato organizado em 2 minutos</h1>
          <p className="lead">Tabela automática, inscrição com PIX, resultados pelo celular e tudo pronto para o grupo do WhatsApp.</p>
          <div className="ctas">
            <Link href="/painel/novo" className="btn lg">Criar meu campeonato</Link>
            <Link href="/para-arenas" className="btn ghost lg">Sou arena ou organizador</Link>
          </div>
          <p className="fine" style={{ marginTop: 10 }}><Link href="/exemplo">Ver um campeonato de exemplo ›</Link></p>
          <p className="fine">Sem mensalidade para começar. Você só precisa de um e-mail.</p>
        </div>
        <div className="mock" aria-hidden="true">
          <div className="mock-head">
            <SportIcon sport="Futebol society" />
            <div className="grow"><b>Copa Verão da Arena</b><span>Society · Grupos + mata-mata</span></div>
            <span className="badge ok">Ao vivo</span>
          </div>
          <div className="round-title"><span>Rodada 2</span><span>sáb, 14/11</span></div>
          <div className="stack">
            {PREVIEW.map(([h, hc, hs, as, a, ac]) => (
              <div className="game" key={h}>
                <div className="gline">
                  <span className="team"><span className="dot" style={{ background: hc }}>{h.slice(0, 2).toUpperCase()}</span><span className="nm">{h}</span></span>
                  <span className="score">{hs} × {as}</span>
                  <span className="team r"><span className="nm">{a}</span><span className="dot" style={{ background: ac }}>{a.slice(0, 2).toUpperCase()}</span></span>
                </div>
              </div>
            ))}
          </div>
          <div className="cta" style={{ marginTop: 12 }}>
            <div className="grow"><b>2 vagas abertas</b><span>R$ 300,00 por time · PIX</span></div>
            <span className="btn sm">Inscrever</span>
          </div>
        </div>
      </section>

      <section className="section" id="como-funciona">
        <h2 className="section-title">Como funciona</h2>
        <p className="sub">Três passos e o campeonato está rodando.</p>
        <div className="grid grid-3">
          {STEPS.map(([t, d], i) => (
            <div className="card step" key={t}>
              <span className="n">{i + 1}</span>
              <div><b>{t}</b><p className="sub" style={{ margin: 0 }}>{d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="esportes">
        <h2 className="section-title">Esportes</h2>
        <p className="sub">Cada esporte com o placar certo: gols, pontos, sets ou mapas.</p>
        <div className="sport-groups">
          {SPORT_GROUPS.map(group => (
            <div className="sport-group" key={group}>
              <h3>{group}</h3>
              {sportsIn(group).map(([key, r]) => (
                <div className="sport-item" key={key}><SportIcon sport={key} size={20} />{r.label}</div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <Link href="/campeonatos" className="card link-card explore-cta">
          <span className="sport-ico g-futebol" aria-hidden="true">🔎</span>
          <span className="grow"><b>Procurando campeonato para jogar?</b><span>Veja os campeonatos com inscrições abertas na sua cidade, presenciais ou online.</span></span>
          <span className="btn ghost sm">Ver campeonatos</span>
        </Link>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="final-cta">
          <h2 className="section-title">Pronto para a primeira rodada?</h2>
          <p className="sub">Crie o campeonato agora e mande o link de inscrição no grupo.</p>
          <Link href="/painel/novo" className="btn lg">Criar meu campeonato</Link>
        </div>
      </section>
    </>
  );
}
