'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cleanCode } from '@/lib/account';
import { createBrowserSupabase } from '@/lib/supabase/browser';

type Factor = { id: string; status: string; factor_type: string };
type Enroll = { id: string; qr: string; secret: string };

/**
 * Verificação em duas etapas com app autenticador (TOTP).
 * Ativar: lê o QR code no app e confirma com o código de 6 dígitos. Desativar: pede o código antes.
 */
export default function TwoFactor() {
  const router = useRouter();
  const [factor, setFactor] = useState<Factor | null | undefined>(undefined);
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [removing, setRemoving] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const load = async () => {
    const sb = createBrowserSupabase();
    const { data } = await sb.auth.mfa.listFactors();
    const all = ((data?.all ?? []) as Factor[]).filter(f => f.factor_type === 'totp');
    setFactor(all.find(f => f.status === 'verified') ?? null);
  };
  useEffect(() => { load(); }, []);

  const start = async () => {
    setBusy(true); setMsg({});
    const sb = createBrowserSupabase();
    // Tentativas antigas que não foram confirmadas atrapalham um cadastro novo.
    const { data: list } = await sb.auth.mfa.listFactors();
    for (const f of ((list?.all ?? []) as Factor[]).filter(f => f.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Campia ${new Date().toLocaleDateString('pt-BR')}` });
    setBusy(false);
    if (error || !data) { setMsg({ err: error?.message ?? 'Não foi possível começar. Tente de novo.' }); return; }
    const d = data as unknown as { id: string; totp: { qr_code: string; secret: string } };
    setEnroll({ id: d.id, qr: d.totp.qr_code, secret: d.totp.secret });
  };

  const confirm = async (factorId: string, after: 'ativar' | 'desativar') => {
    const c = cleanCode(code);
    if (c.length !== 6) { setMsg({ err: 'Digite os 6 números que aparecem no app' }); return; }
    setBusy(true); setMsg({});
    const sb = createBrowserSupabase();
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: c });
    if (error) { setBusy(false); setMsg({ err: 'Código errado ou vencido. Confira o horário do celular e tente o código novo.' }); return; }
    if (after === 'desativar') {
      const { error: e2 } = await sb.auth.mfa.unenroll({ factorId });
      if (e2) { setBusy(false); setMsg({ err: e2.message }); return; }
    }
    setBusy(false); setCode(''); setEnroll(null); setRemoving(false);
    setMsg({ ok: after === 'ativar' ? 'Pronto! A partir de agora, depois do link do e-mail, a Campia vai pedir o código do app.' : 'Verificação em duas etapas desligada.' });
    await load();
    router.refresh();
  };

  const codeInput = (
    <input className="inp code-inp" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000"
      value={code} onChange={(e: { target: { value: string } }) => setCode(cleanCode(e.target.value))} aria-label="Código de 6 dígitos" />
  );

  return (
    <section className="card" id="seguranca">
      <b>🔐 Verificação em duas etapas</b>
      {factor === undefined ? <p className="sub">Carregando…</p> : factor ? (
        <>
          <p className="sub" style={{ margin: '4px 0 10px' }}><span className="badge ok">Ativada</span> Ao entrar, depois do link do e-mail, a Campia pede o código do seu app autenticador.</p>
          {!removing ? <button className="btn ghost sm" onClick={() => { setRemoving(true); setMsg({}); }}>Desativar</button> : (
            <div className="twofa-step">
              <label>Para desativar, digite o código do app</label>
              {codeInput}
              <div className="actions"><button className="btn danger sm" disabled={busy} onClick={() => confirm(factor.id, 'desativar')}>Desativar</button><button className="btn ghost sm" onClick={() => setRemoving(false)}>Cancelar</button></div>
            </div>
          )}
        </>
      ) : enroll ? (
        <div className="twofa-step">
          <p className="sub" style={{ margin: '4px 0 10px' }}>1. Abra o app autenticador (Google Authenticator, Microsoft Authenticator ou Authy) e leia este QR code.</p>
          <div className="qr twofa-qr"><img src={enroll.qr} alt="QR code para o app autenticador" /></div>
          <p className="sub small">Não consegue ler? Digite esta chave no app: <code className="secret">{enroll.secret}</code></p>
          <label>2. Digite o código de 6 números que apareceu no app</label>
          {codeInput}
          <div className="actions"><button className="btn sm" disabled={busy} onClick={() => confirm(enroll.id, 'ativar')}>Confirmar e ativar</button><button className="btn ghost sm" onClick={() => setEnroll(null)}>Cancelar</button></div>
        </div>
      ) : (
        <>
          <p className="sub" style={{ margin: '4px 0 10px' }}>Proteja sua conta: além do link no e-mail, a entrada pede um código do app autenticador do seu celular. Recomendado para quem recebe inscrições pela Campia.</p>
          <button className="btn sm" disabled={busy} onClick={start}>Ativar verificação em duas etapas</button>
        </>
      )}
      {msg.ok && <div className="alert ok" style={{ marginTop: 12 }}>{msg.ok}</div>}
      {msg.err && <div className="alert err" style={{ marginTop: 12 }}>{msg.err}</div>}
    </section>
  );
}
