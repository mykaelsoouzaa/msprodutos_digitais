import Link from 'next/link';

/** Aviso de recurso do Plano Pro, com o botão para assinar. */
export default function ProLock({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="card pro-lock">
      <b><span className="badge pro" style={{ marginRight: 8 }}>Pro</span>{title}</b>
      <p className="sub" style={{ margin: '6px 0 0' }}>{text}</p>
      {children}
      <div className="actions"><Link href="/painel/plano" className="btn sm">Conhecer o Pro</Link></div>
    </div>
  );
}
