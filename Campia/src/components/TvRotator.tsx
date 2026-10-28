'use client';
import { useEffect, useState } from 'react';

/** Passa sozinho pelas telas do modo TV (e mostra o relógio). */
export default function TvRotator({ slides, seconds = 15 }: { slides: Array<{ key: string; title: string; content: React.ReactNode }>; seconds?: number }) {
  const [i, setI] = useState(0);
  const [now, setNow] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setI((i + 1) % Math.max(1, slides.length)), seconds * 1000);
    return () => clearTimeout(t);
  }, [i, slides.length, seconds]);
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }));
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);
  const cur = slides[i % Math.max(1, slides.length)];
  return (
    <>
      <div className="tv-bar">
        <div className="tv-dots">{slides.map((s, k) => <span key={s.key} className={k === i % slides.length ? 'on' : ''}>{s.title}</span>)}</div>
        <span className="tv-clock">{now}</span>
      </div>
      <div className="tv-slide" key={cur?.key}>{cur?.content}</div>
    </>
  );
}
