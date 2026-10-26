import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card" style={{ textAlign: 'center', marginTop: 24 }}>
      <h1>Página não encontrada</h1>
      <p className="sub">O link pode estar errado ou o campeonato foi removido.</p>
      <Link href="/" className="btn">Voltar ao início</Link>
    </div>
  );
}
