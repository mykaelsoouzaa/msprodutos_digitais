'use client';
import { useEffect, useState } from 'react';

import { THEME_COLORS, THEME_KEY as KEY, type ThemeMode as Mode } from '@/lib/theme';

const LABEL: Record<Mode, string> = { auto: '🌗 Tema: automático', light: '☀️ Tema: claro', dark: '🌙 Tema: escuro' };
const NEXT: Record<Mode, Mode> = { auto: 'light', light: 'dark', dark: 'auto' };

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === 'auto') delete root.dataset.theme; else root.dataset.theme = mode;
  // Barra do navegador no celular: no automático cada meta volta a valer para o seu modo.
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    const own = (m.getAttribute('media') ?? '').includes('light') ? THEME_COLORS.light : THEME_COLORS.dark;
    m.setAttribute('content', mode === 'auto' ? own : THEME_COLORS[mode]);
  });
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>('auto');
  useEffect(() => {
    try { const t = localStorage.getItem(KEY); if (t === 'light' || t === 'dark') setMode(t); } catch { /* sem armazenamento */ }
  }, []);
  const change = () => {
    const next = NEXT[mode];
    setMode(next);
    apply(next);
    try { if (next === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, next); } catch { /* sem armazenamento */ }
  };
  return <button type="button" className="theme-toggle" onClick={change} aria-label="Trocar tema">{LABEL[mode]}</button>;
}
