'use client';

export default function PrintButton({ label = 'Imprimir ou salvar PDF' }: { label?: string }) {
  return <button type="button" className="btn" onClick={() => window.print()}>🖨 {label}</button>;
}
