'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/app/entrar/actions';
import { initialsOf } from '@/lib/account';

type Me = { logged: false } | { logged: true; name: string; email: string; admin?: boolean };

/** Topo do site: "Entrar" para quem não está logado; nome, e-mail e "Sair" para quem está. */
export default function AccountMenu() {
  const path = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/eu', { cache: 'no-store' }).then(r => r.json()).then((d: Me) => { if (alive) setMe(d); }).catch(() => { if (alive) setMe({ logged: false }); });
    return () => { alive = false; };
  }, [path]);

  if (!me) return <span className="acct-placeholder" aria-hidden="true" />;
  if (!me.logged) return <Link href={`/entrar?voltar=${encodeURIComponent(path.startsWith('/entrar') ? '/painel' : path)}`} className="btn ghost sm">Entrar</Link>;

  return (
    <details className="acct" key={path}>
      <summary aria-label={`Conta de ${me.name}`}>
        <span className="acct-avatar">{initialsOf(me.name)}</span>
        <span className="acct-name">{me.name}</span>
      </summary>
      <div className="acct-panel">
        <div className="acct-who">
          <b>{me.name}</b>
          <span>{me.email}</span>
        </div>
        <Link href="/painel">Painel do organizador</Link>
        <Link href="/meus-times">Meus times</Link>
        <Link href="/atleta">Meu perfil de atleta</Link>
        <Link href="/conta">Minha conta e segurança</Link>
        {me.admin && <Link href="/admin" className="acct-admin">⚙️ Admin da Campia</Link>}
        <form action={signOut}><button className="acct-out">Sair</button></form>
      </div>
    </details>
  );
}
