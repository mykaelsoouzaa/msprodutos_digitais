import type { Metadata } from 'next';
import { Flash } from '@/components/champ';
import { sendMagicLink } from './actions';

export const metadata: Metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; enviado?: string; voltar?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="auth">
      <section className="auth-brand">
        <img src="/brand/campia-simbolo.svg" alt="" width={56} height={56} style={{ display: 'block' }} />
        <h1>Seu painel de organizador</h1>
        <p className="sub" style={{ margin: 0, maxWidth: 420 }}>Crie campeonatos, acompanhe as inscrições pagas e lance os resultados de qualquer lugar.</p>
        <ul>
          <li><i>1</i>Tabela e horários gerados na hora</li>
          <li><i>2</i>Inscrição com PIX, vaga confirmada sozinha</li>
          <li><i>3</i>Classificação e arte da rodada prontas</li>
        </ul>
        <span className="ring" aria-hidden="true" />
      </section>
      <section className="card auth-form">
        <h2>Entrar</h2>
        {sp.enviado ? (
          <>
            <Flash ok="Link enviado! Abra o seu e-mail e toque no link para entrar." />
            <p className="sub">Não chegou? Confira a caixa de spam ou peça outro link abaixo.</p>
          </>
        ) : (
          <p className="sub">Digite seu e-mail e enviamos um link de acesso. Sem senha para lembrar.</p>
        )}
        <Flash erro={sp.erro} />
        <form action={sendMagicLink}>
          <input type="hidden" name="voltar" value={sp.voltar ?? '/painel'} />
          <label htmlFor="email" style={{ marginTop: 0 }}>E-mail</label>
          <input id="email" name="email" type="email" className="inp" required autoComplete="email" inputMode="email" placeholder="voce@exemplo.com" />
          <div style={{ marginTop: 14 }}><button className="btn block lg">{sp.enviado ? 'Enviar outro link' : 'Receber link de acesso'}</button></div>
        </form>
        <p className="tip">Primeira vez? É o mesmo caminho: o link cria sua conta automaticamente.</p>
      </section>
    </div>
  );
}
