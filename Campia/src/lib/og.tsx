// Imagens de prévia (Open Graph, 1200×630) que aparecem ao colar um link da Campia no WhatsApp, Instagram etc.
// Gerada pelo next/og (Satori): todo bloco precisa de display flex e estilos simples.

export const OG_SIZE = { width: 1200, height: 630 };

export function CampiaMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#16a34a" /><stop offset="1" stopColor="#84cc16" /></linearGradient></defs>
      <rect width="512" height="512" rx="116" fill="url(#g)" />
      <path d="M 360 160 A 142 142 0 1 0 360 352" fill="none" stroke="#fff" strokeWidth="70" strokeLinecap="round" />
      <circle cx="372" cy="256" r="40" fill="#06210f" />
    </svg>
  );
}

/** Moldura padrão: fundo verde escuro, marca no topo, conteúdo no meio e rodapé com o endereço. */
export function OgFrame({ eyebrow, title, lines, badge }: { eyebrow?: string; title: string; lines: string[]; badge?: { text: string; color: string } }) {
  const big = title.length > 34 ? 64 : 80;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 64px', color: '#eaf4ee',
      background: 'linear-gradient(135deg, #14532d 0%, #0b1410 60%, #052e16 100%)', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <CampiaMark size={60} />
        <span style={{ display: 'flex', fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>campia</span>
        {badge && <span style={{ display: 'flex', marginLeft: 'auto', fontSize: 28, fontWeight: 800, padding: '10px 22px', borderRadius: 999, background: badge.color, color: '#06210f' }}>{badge.text}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', marginBottom: 'auto' }}>
        {eyebrow && <span style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#a3e635', textTransform: 'uppercase', letterSpacing: 3 }}>{eyebrow}</span>}
        <span style={{ display: 'flex', fontSize: big, fontWeight: 800, lineHeight: 1.05, marginTop: 14, letterSpacing: -2 }}>{title.slice(0, 70)}</span>
        {lines.filter(Boolean).map(l => <span key={l} style={{ display: 'flex', fontSize: 32, color: 'rgba(234,244,238,0.75)', marginTop: 16 }}>{l}</span>)}
      </div>
      <span style={{ display: 'flex', fontSize: 26, color: 'rgba(234,244,238,0.55)' }}>campia.app.br</span>
    </div>
  );
}
