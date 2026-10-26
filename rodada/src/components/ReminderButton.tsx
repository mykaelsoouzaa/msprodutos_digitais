'use client';
import { useEffect, useState } from 'react';
import { subscribePush, unsubscribePush } from '@/app/c/[slug]/push-actions';
import { isStandalone } from './PwaSetup';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function keyToBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

type State = 'carregando' | 'sem-suporte' | 'instalar-ios' | 'bloqueado' | 'desligado' | 'ligado';

/** Ativa lembretes do campeonato (ou de um time) por notificação no celular. */
export default function ReminderButton({ championshipId, teams }: { championshipId: string; teams: Array<{ id: string; name: string }> }) {
  const [state, setState] = useState<State>('carregando');
  const [team, setTeam] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID) {
        setState(ios && !isStandalone() ? 'instalar-ios' : 'sem-suporte');
        return;
      }
      if (Notification.permission === 'denied') { setState('bloqueado'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      let on = false;
      try { on = !!sub && localStorage.getItem(`rodada-push-${championshipId}`) === '1'; } catch { /* ok */ }
      setState(on ? 'ligado' : 'desligado');
    })().catch(() => setState('sem-suporte'));
  }, [championshipId]);

  async function enable() {
    setBusy(true); setMsg('');
    try {
      // O pedido de permissão precisa partir de um toque (exigência do iPhone).
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'bloqueado' : 'desligado'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await subscribePush({ championshipId, teamId: team || null, subscription: json });
      if (!res.ok) { setMsg(res.error); return; }
      try { localStorage.setItem(`rodada-push-${championshipId}`, '1'); } catch { /* ok */ }
      setState('ligado'); setMsg('Pronto! Você recebe um aviso 1 dia e 1 hora antes de cada jogo.');
    } catch {
      setMsg('Não foi possível ativar as notificações neste aparelho.');
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await unsubscribePush({ championshipId, endpoint: sub.endpoint });
      try { localStorage.removeItem(`rodada-push-${championshipId}`); } catch { /* ok */ }
      setState('desligado'); setMsg('Lembretes desligados para este campeonato.');
    } finally { setBusy(false); }
  }

  if (state === 'carregando') return null;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <b>🔔 Lembretes dos jogos</b>
      {state === 'instalar-ios' && <p className="sub" style={{ margin: '4px 0 0' }}>No iPhone, primeiro instale o app: toque em Compartilhar › &quot;Adicionar à Tela de Início&quot; e abra o Rodada pelo ícone.</p>}
      {state === 'sem-suporte' && <p className="sub" style={{ margin: '4px 0 0' }}>Este navegador não recebe notificações. Tente pelo Chrome no Android ou pelo app instalado no iPhone.</p>}
      {state === 'bloqueado' && <p className="sub" style={{ margin: '4px 0 0' }}>As notificações estão bloqueadas. Libere nas configurações do navegador para este site.</p>}
      {state === 'desligado' && (
        <>
          <p className="sub" style={{ margin: '4px 0 8px' }}>Receba um aviso no celular 1 dia e 1 hora antes de cada jogo.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="inp" value={team} onChange={(e: { target: { value: string } }) => setTeam(e.target.value)} aria-label="Time para seguir">
              <option value="">Todos os jogos</option>
              {teams.map(t => <option key={t.id} value={t.id}>Só {t.name}</option>)}
            </select>
            <button className="btn" onClick={enable} disabled={busy}>{busy ? '...' : 'Ativar'}</button>
          </div>
        </>
      )}
      {state === 'ligado' && <div className="actions"><span className="badge ok">Ativado</span><button className="btn ghost sm" onClick={disable} disabled={busy}>Desligar</button></div>}
      {msg && <p className="sub small" style={{ margin: '8px 0 0' }}>{msg}</p>}
    </div>
  );
}
