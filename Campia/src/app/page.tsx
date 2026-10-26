import Link from 'next/link';
import { SPORTS } from '@/lib/domain/sports';

export default function Home() {
  return (
    <>
      <div className="hero" style={{ textAlign: 'center', padding: '28px 18px' }}>
        <img src="/brand/campia-simbolo.svg" alt="" width={64} height={64} style={{ display: 'block', margin: '0 auto 14px' }} />
        <h1 style={{ fontSize: 30, lineHeight: 1.15 }}>Seu campeonato organizado em 2 minutos</h1>
        <p className="sub" style={{ margin: '10px 0 16px' }}>
          Tabela automática, inscrição com PIX, resultados pelo celular e tudo pronto para o grupo do WhatsApp.
        </p>
        <Link href="/painel/novo" className="btn block">Criar meu campeonato</Link>
      </div>
      <h2>Como funciona</h2>
      <div className="stack">
        {[
          ['1. Crie o campeonato', 'Escolha o esporte e o formato. A tabela e os horários saem prontos.'],
          ['2. Mande o link no grupo', 'Cada capitão inscreve o time e paga pelo PIX. A vaga é confirmada sozinha.'],
          ['3. Lance os resultados', 'Classificação, mata-mata e artilharia se atualizam; a arte da rodada sai pronta.'],
        ].map(([t, d]) => <div className="card" key={t}><b>{t}</b><p className="sub" style={{ margin: '4px 0 0' }}>{d}</p></div>)}
      </div>
      <h2>Esportes</h2>
      <p className="sub">{Object.entries(SPORTS).map(([k, v]) => `${v.icon} ${k}`).join(' · ')}</p>
    </>
  );
}
