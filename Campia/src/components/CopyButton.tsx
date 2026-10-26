'use client';
import { useState } from 'react';

export default function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost sm"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* sem permissão */ }
      }}
    >
      {done ? 'Copiado!' : label}
    </button>
  );
}
