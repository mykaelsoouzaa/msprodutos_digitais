import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import TwoFactor from '@/components/TwoFactor';
import { displayName } from '@/lib/account';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../entrar/actions';
import { deleteAccount, updateName } from './actions';

export const metadata: Metadata = { title: 'Minha conta', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Conta({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const name = displayName(user?.user_metadata?.name, user?.email);
  const saved = typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim();

  return (
    <div className="narrow">
      <h1>Minha conta</h1>
      <Flash ok={sp.ok} erro={sp.erro} />
      <form action={updateName} className="card">
        <b>Seus dados</b>
        <label htmlFor="c-name">Nome</label>
        <input id="c-name" name="name" className="inp" required minLength={2} maxLength={60} defaultValue={saved ? name : ''} placeholder="Ex.: Mykael Souza" />
        <label>E-mail de acesso</label>
        <div className="copybox" style={{ marginTop: 0 }}>{user?.email}</div>
        <p className="sub small" style={{ margin: '6px 0 0' }}>A entrada é sempre pelo link enviado para este e-mail. Não existe senha para esquecer.</p>
        <div style={{ marginTop: 14 }}><button className="btn sm">Salvar nome</button></div>
      </form>
      <div style={{ marginTop: 16 }}><TwoFactor /></div>
      <div className="card" style={{ marginTop: 16 }}>
        <b>Atalhos</b>
        <div className="actions">
          <Link href="/painel" className="btn ghost sm">Painel</Link>
          <Link href="/meus-times" className="btn ghost sm">Meus times</Link>
          <Link href="/atleta" className="btn ghost sm">Perfil de atleta</Link>
          <Link href="/painel/plano" className="btn ghost sm">Plano</Link>
        </div>
      </div>
      <form action={signOut} style={{ marginTop: 16 }}><button className="btn danger block">Sair da conta</button></form>
      <section className="card" id="privacidade" style={{ marginTop: 16 }}>
        <b>🔒 Seus dados</b>
        <p className="sub" style={{ margin: '4px 0 10px' }}>Baixe tudo que a Campia guarda sobre você: conta, times, inscrições, perfil de atleta e votos.</p>
        <a href="/conta/meus-dados" className="btn ghost sm" download>⬇ Baixar meus dados</a>
      </section>
      <details className="card danger-zone" id="excluir" style={{ marginTop: 16 }}>
        <summary><b>Excluir minha conta</b></summary>
        <form action={deleteAccount} style={{ marginTop: 10 }}>
          <p className="sub" style={{ margin: '0 0 10px' }}>Apaga sua conta, sua página de arena, seus campeonatos sem inscrição paga, seu perfil de atleta e seus votos, e tira seu e-mail dos times em que você é capitão. Se você tem o Pro, a assinatura é cancelada. Não dá para desfazer.</p>
          <label htmlFor="del-confirm" style={{ marginTop: 0 }}>Digite EXCLUIR para confirmar</label>
          <input id="del-confirm" name="confirm" className="inp" required pattern="EXCLUIR" autoComplete="off" placeholder="EXCLUIR" />
          <div style={{ marginTop: 12 }}><button className="btn danger sm">Excluir minha conta</button></div>
        </form>
      </details>
    </div>
  );
}
