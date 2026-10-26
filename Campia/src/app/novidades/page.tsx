import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_VERSION, CHANGELOG } from '@/lib/version';

export const metadata: Metadata = { title: 'Novidades', description: 'O que mudou em cada versão da Campia.' };

export default function Novidades() {
  return (
    <div className="narrow">
      <Link href="/" className="back-link">‹ Início</Link>
      <h1>Novidades</h1>
      <p className="sub">Você está na versão <b style={{ color: 'var(--text)' }}>{APP_VERSION}</b>. Aqui fica tudo o que melhorou em cada atualização.</p>
      <ol className="releases">
        {CHANGELOG.map((r, i) => (
          <li key={r.version} className="release">
            <div className="release-head">
              <span className={`badge ${i === 0 ? 'ok' : 'open'}`}>v{r.version}</span>
              <span className="small" style={{ color: 'var(--muted)' }}>{r.date.split('-').reverse().join('/')}</span>
              {i === 0 && <span className="badge wait">Atual</span>}
            </div>
            <h3>{r.title}</h3>
            <ul>{r.items.map(it => <li key={it}>{it}</li>)}</ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
