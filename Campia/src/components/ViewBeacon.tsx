'use client';
import { useEffect } from 'react';
import { classifySource, type ViewPage } from '@/lib/visits';

const TRACKING = ['origem', 'utm_source', 'utm_medium', 'utm_campaign', 'ref'];

/** Conta a visita uma vez por aba (recarregar não soma de novo) e anota de onde a pessoa veio. */
export default function ViewBeacon({ slug, page }: { slug: string; page: ViewPage }) {
  useEffect(() => {
    const key = `campia-visita:${slug}:${page}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* aba anônima: conta mesmo assim */ }

    const params = new URLSearchParams(location.search);
    const source = classifySource(document.referrer, params, location.hostname);
    const body = JSON.stringify({ slug, page, source });
    if (!navigator.sendBeacon?.('/api/visita', body)) {
      fetch('/api/visita', { method: 'POST', body, keepalive: true }).catch(() => {});
    }

    // Tira a marca de origem do endereço, para não ir junto se a pessoa copiar o link.
    if (TRACKING.some(k => params.has(k))) {
      TRACKING.forEach(k => params.delete(k));
      const q = params.toString();
      history.replaceState(history.state, '', location.pathname + (q ? `?${q}` : '') + location.hash);
    }
  }, [slug, page]);
  return null;
}
