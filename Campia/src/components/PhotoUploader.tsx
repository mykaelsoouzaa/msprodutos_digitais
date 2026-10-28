'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addPhoto } from '@/app/painel/photo-actions';
import { fitSize } from '@/lib/photos';

/** Reduz a foto no próprio aparelho (JPG ~1600 px) antes de enviar. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const { w, h } = fitSize(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  for (const q of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= 1024 * 1024) return blob;
  }
  throw new Error('não foi possível reduzir');
}

export default function PhotoUploader({ championshipId }: { championshipId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const list = Array.from(files).slice(0, 20);
    let ok = 0; const errors: string[] = [];
    for (const [i, f] of list.entries()) {
      setStatus(`Enviando ${i + 1} de ${list.length}…`);
      try {
        const blob = await shrink(f);
        const fd = new FormData();
        fd.set('championship', championshipId);
        fd.set('photo', new File([blob], f.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        const r = await addPhoto(fd);
        if (r.ok) ok++; else errors.push(r.error);
      } catch { errors.push(`${f.name}: formato não suportado`); }
    }
    setBusy(false);
    setStatus(`${ok} foto${ok === 1 ? '' : 's'} enviada${ok === 1 ? '' : 's'}${errors.length ? `. ${[...new Set(errors)].join(' · ')}` : ''}`);
    router.refresh();
  };

  return (
    <div>
      <label className={`btn sm ${busy ? 'disabled' : ''}`} style={{ cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Enviando…' : '📷 Adicionar fotos'}
        <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e: { target: { files: FileList | null } }) => onFiles(e.target.files)} />
      </label>
      {status && <p className="sub small" style={{ margin: '8px 0 0' }}>{status}</p>}
    </div>
  );
}
