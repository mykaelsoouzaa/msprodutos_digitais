import type { Metadata } from 'next';
import { Flash } from '@/components/champ';
import { sendMagicLink } from './actions';

export const metadata: Metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; enviado?: string; voltar?: string }> }) {
  const sp = await searchParams;
  return (
    <div style={{ maxWidth: 420, margin: '24px auto' }}>
      <h1>Entrar no painel</h1>
      <p className="sub">Enviamos um link de acesso para o seu e-mail. Sem senha.</p>
      <Flash erro={sp.erro} ok={sp.enviado ? 'Link enviado! Abra o seu e-mail e toque no link para entrar.' : undefined} />
      <form action={sendMagicLink} className="card">
        <input type="hidden" name="voltar" value={sp.voltar ?? '/painel'} />
        <label htmlFor="email" style={{ marginTop: 0 }}>E-mail</label>
        <input id="email" name="email" type="email" className="inp" required autoComplete="email" placeholder="voce@exemplo.com" />
        <div style={{ marginTop: 14 }}><button className="btn block">Receber link de acesso</button></div>
      </form>
    </div>
  );
}
