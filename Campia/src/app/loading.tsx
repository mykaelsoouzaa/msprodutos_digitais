// Mostrado enquanto uma página carrega os dados.
export default function Loading() {
  return (
    <div className="loading" role="status" aria-label="Carregando">
      <svg viewBox="0 0 512 512" width="56" height="56" aria-hidden="true">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#16a34a" /><stop offset="1" stopColor="#84cc16" /></linearGradient></defs>
        <rect width="512" height="512" rx="116" fill="url(#lg)" />
        <path className="loading-arc" d="M 360 160 A 142 142 0 1 0 360 352" fill="none" stroke="#fff" strokeWidth="70" strokeLinecap="round" pathLength={100} />
        <circle className="loading-ball" cx="372" cy="256" r="40" fill="#06210f" />
      </svg>
      <span>Carregando…</span>
    </div>
  );
}
