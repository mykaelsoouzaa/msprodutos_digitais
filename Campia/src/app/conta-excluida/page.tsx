import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Conta excluída', robots: { index: false, follow: false } };

export default function ContaExcluida() {
  return (
    <div className="card narrow" style={{ textAlign: 'center', marginTop: 20 }}>
      <div style={{ fontSize: 46 }}>👋</div>
      <h1>Sua conta foi excluída</h1>
      <p className="sub">Apagamos sua conta e os dados ligados a ela. Se mudar de ideia, é só entrar de novo com seu e-mail para criar uma conta nova.</p>
      <Link href="/" className="btn">Voltar ao início</Link>
    </div>
  );
}
