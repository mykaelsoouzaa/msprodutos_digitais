'use client';
import { useState } from 'react';
import { signOut } from '../actions';
import { cleanCode } from '@/lib/account';
import { createBrowserSupabase } from '@/lib/supabase/browser';

export default function VerifyCode({ back }: { back: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const c = cleanCode(code);
    if (c.length !== 6) { setErr('Digite os 6 números do app'); return; }
    setBusy(true); setErr('');
    const sb = createBrowserSupabase();
    const { data } = await sb.auth.mfa.listFactors();
    const factor = (data?.totp ?? [])[0];
    if (!factor) { window.location.assign(back); return; }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: c });
    if (error) { setBusy(false); setErr('Código errado ou vencido. Espere o próximo código e tente de novo.'); return; }
    window.location.assign(back); // recarrega para o servidor ver a sessão verificada
  };

  return (
    <>
      <form onSubmit={submit} className="card">
        <label htmlFor="code" style={{ marginTop: 0 }}>Código de 6 números</label>
        <input id="code" className="inp code-inp" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} placeholder="000000"
          value={code} onChange={(e: { target: { value: string } }) => setCode(cleanCode(e.target.value))} />
        {err && <div className="alert err" style={{ marginTop: 12 }}>{err}</div>}
        <div style={{ marginTop: 14 }}><button className="btn block" disabled={busy}>{busy ? 'Conferindo…' : 'Entrar'}</button></div>
      </form>
      <form action={signOut} style={{ marginTop: 12, textAlign: 'center' }}>
        <button className="btn ghost sm">Perdi o celular · sair</button>
      </form>
      <p className="sub small" style={{ textAlign: 'center' }}>Perdeu o acesso ao app? Escreva para <a href="mailto:contato@campia.app.br">contato@campia.app.br</a> do e-mail da conta.</p>
    </>
  );
}
