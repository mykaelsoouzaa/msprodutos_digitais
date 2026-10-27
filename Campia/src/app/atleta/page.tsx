import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import { handleFrom } from '@/lib/athlete';
import { type Athlete, loadAthleteEntries } from '@/lib/athlete-data';
import { siteUrl } from '@/lib/env';
import { UFS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { leaveClaim, saveAthlete } from './actions';

export const metadata: Metadata = { title: 'Meu perfil de atleta', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function MeuPerfil({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from('athletes').select('user_id, handle, name, city, state, bio').eq('user_id', user.id).maybeSingle<Athlete>()
    : { data: null };
  const rows = user ? await loadAthleteEntries(supabase, user.id, false) : [];
  const suggested = handleFrom((user?.email ?? '').split('@')[0] || 'atleta');

  return (
    <div className="narrow">
      <div className="page-head">
        <div>
          <h1>Meu perfil de atleta</h1>
          <p className="sub" style={{ margin: 0 }}>Seus gols, títulos e prêmios de todos os campeonatos da Campia, numa página só.</p>
        </div>
        {me && <Link href={`/atleta/${me.handle}`} className="btn ghost">Ver meu perfil</Link>}
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />

      <form action={saveAthlete} className="card">
        <b>{me ? 'Dados do perfil' : 'Crie seu perfil'}</b>
        <label htmlFor="a-name">Nome que aparece</label>
        <input id="a-name" name="name" className="inp" required minLength={2} maxLength={60} defaultValue={me?.name ?? ''} placeholder="Ex.: Rafinha" />
        <label htmlFor="a-handle">Endereço da página</label>
        <div className="prefixed"><span>{siteUrl().replace(/^https?:\/\//, '')}/atleta/</span><input id="a-handle" name="handle" className="inp" required minLength={3} maxLength={40} pattern="[a-zA-Z0-9-]{3,40}" defaultValue={me?.handle ?? suggested} /></div>
        <div className="city-uf">
          <div><label htmlFor="a-city">Cidade</label><input id="a-city" name="city" className="inp" maxLength={60} defaultValue={me?.city ?? ''} /></div>
          <div>
            <label htmlFor="a-state">Estado</label>
            <select id="a-state" name="state" className="inp" defaultValue={me?.state ?? ''}>
              <option value="">UF</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
        <label htmlFor="a-bio">Sobre você (opcional)</label>
        <textarea id="a-bio" name="bio" className="inp" maxLength={200} rows={2} style={{ minHeight: 70 }} defaultValue={me?.bio ?? ''} placeholder="Ex.: Meia, joga no Real Várzea desde 2019" />
        <div style={{ marginTop: 14 }}><button className="btn">{me ? 'Salvar' : 'Criar perfil'}</button></div>
      </form>

      <h2 className="section-title" style={{ marginTop: 28 }}>Campeonatos no perfil</h2>
      <p className="sub">Para incluir um campeonato: abra a página dele, vá na aba <b>Times</b> e toque em <b>Sou eu</b> ao lado do seu nome. O capitão do time confirma.</p>
      {rows.length ? (
        <div className="stack">
          {rows.map(({ c, e }) => (
            <form key={c.player_id} action={leaveClaim} className="card sponsor-admin">
              <input type="hidden" name="player" value={c.player_id} />
              <span className="dot" style={{ background: e.team.color }}>{e.team.short}</span>
              <span className="grow wrap">
                <b>{e.championship.name}</b>
                <span className="sub small">{e.playerName} · {e.team.name} · {c.status === 'pendente' ? <span className="badge wait">aguardando o capitão</span> : <span className="badge ok">no perfil</span>}</span>
              </span>
              <button className="btn ghost sm" aria-label={`Tirar ${e.championship.name} do perfil`}>Tirar</button>
            </form>
          ))}
        </div>
      ) : <div className="card empty">Nenhum campeonato ainda. <Link href="/campeonatos">Procure o campeonato que você jogou</Link>.</div>}
    </div>
  );
}
