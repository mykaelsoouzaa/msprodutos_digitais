'use client';
import { useEffect, useState } from 'react';
import { liveMinute } from '@/lib/live';

export default function LiveClock({ since }: { since: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);
  const m = now === null ? null : liveMinute(since, now);
  return m === null ? null : <span className="live-clock" title="Tempo desde o início">⏱ {m}&apos;</span>;
}
