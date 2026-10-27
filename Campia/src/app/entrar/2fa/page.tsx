import type { Metadata } from 'next';
import VerifyCode from './VerifyCode';

export const metadata: Metadata = { title: 'Código de verificação', robots: { index: false, follow: false } };

export default async function DoisFatores({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const sp = await searchParams;
  const back = sp.voltar && sp.voltar.startsWith('/') && !sp.voltar.startsWith('//') ? sp.voltar : '/painel';
  return (
    <div className="narrow">
      <h1>Código de verificação</h1>
      <p className="sub">Sua conta tem verificação em duas etapas. Abra o app autenticador do celular e digite o código da Campia.</p>
      <VerifyCode back={back} />
    </div>
  );
}
