'use client';
import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Registra o service worker e mostra o convite para instalar o app. */
export default function PwaSetup() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    let dismissed = false;
    try { dismissed = localStorage.getItem('campia-install-dismissed') === '1'; } catch { /* sem storage */ }
    if (isStandalone() || dismissed) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent); setHidden(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (isIos()) { setIosHint(true); setHidden(false); }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem('campia-install-dismissed', '1'); } catch { /* ok */ } };

  return (
    <div className="install">
      <span style={{ fontSize: 22 }}>📲</span>
      <div className="grow">
        <b>Instale a Campia</b>
        <span>{iosHint ? 'No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".' : 'Abra os campeonatos direto da tela inicial e receba lembretes dos jogos.'}</span>
      </div>
      {prompt && <button className="btn sm" onClick={async () => { await prompt.prompt(); await prompt.userChoice; setHidden(true); }}>Instalar</button>}
      <button className="btn ghost sm" onClick={dismiss} aria-label="Fechar">✕</button>
    </div>
  );
}
