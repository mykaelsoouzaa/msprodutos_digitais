import type { Metadata } from 'next';
import Link from 'next/link';
import InstagramIcon from '@/components/InstagramIcon';
import { COMPANY, instagramUrl } from '@/lib/company';

export const metadata: Metadata = {
  title: 'Sobre a Campia',
  description: `A Campia é a plataforma de campeonatos amadores da ${COMPANY.name}: inscrição com PIX, tabela automática e resultados ao vivo.`,
  alternates: { canonical: '/sobre' },
};

export default function Sobre() {
  return (
    <div className="narrow about">
      <h1>Sobre a Campia</h1>
      <p className="lead" style={{ marginTop: 0 }}>A Campia nasceu para tirar o campeonato amador do caderno e do grupo bagunçado de WhatsApp.</p>
      <div className="card">
        <p style={{ marginTop: 0 }}>Com ela, a arena ou o organizador monta o campeonato em minutos: a tabela sai pronta, cada capitão inscreve o time e paga pelo PIX, os resultados são lançados pelo celular e a classificação, a artilharia e as artes para os stories se atualizam sozinhas.</p>
        <p>Funciona para futebol, quadra, areia, raquete e e-sports, sem precisar instalar nada.</p>
        <p style={{ marginBottom: 0 }}>A Campia é um produto da <b>{COMPANY.name}</b>.</p>
      </div>
      <h2 className="section-title" style={{ marginTop: 28 }}>Fale com a gente</h2>
      <div className="stack" style={{ marginTop: 12 }}>
        <a className="card link-card" href={instagramUrl(COMPANY.instagram)} target="_blank" rel="noopener">
          <InstagramIcon size={22} /><span className="grow"><b>@{COMPANY.instagram}</b><span>Novidades e campeonatos da Campia</span></span><span style={{ color: 'var(--muted)' }}>›</span>
        </a>
        <a className="card link-card" href={instagramUrl(COMPANY.companyInstagram)} target="_blank" rel="noopener">
          <InstagramIcon size={22} /><span className="grow"><b>@{COMPANY.companyInstagram}</b><span>{COMPANY.name}</span></span><span style={{ color: 'var(--muted)' }}>›</span>
        </a>
        <a className="card link-card" href={`mailto:${COMPANY.email}`}>
          <span style={{ fontSize: 20 }}>✉️</span><span className="grow"><b>{COMPANY.email}</b><span>Dúvidas, parcerias e suporte</span></span><span style={{ color: 'var(--muted)' }}>›</span>
        </a>
      </div>
      <div className="actions" style={{ marginTop: 20, justifyContent: 'center' }}>
        <Link href="/para-arenas" className="btn">Para arenas e organizadores</Link>
        <Link href="/exemplo" className="btn ghost">Ver um exemplo</Link>
      </div>
    </div>
  );
}
