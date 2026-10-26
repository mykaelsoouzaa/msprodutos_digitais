import type { Metadata } from 'next';
import Link from 'next/link';
import ChampCard from '@/components/ChampCard';
import { SPORT_GROUPS, type SportGroup, sportsIn } from '@/lib/domain/sports';
import { arenasByOwner } from '@/lib/arena';
import { LISTING_SELECT, type ListingRow, likeTerm, toListing } from '@/lib/explore';
import { UFS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Campeonatos',
  description: 'Encontre campeonatos amadores com inscrições abertas perto de você: futebol, quadra, areia, raquete e e-sports.',
};
export const dynamic = 'force-dynamic';

type Search = { q?: string; uf?: string; cidade?: string; cat?: string; modo?: string; abertas?: string };

export default async function Campeonatos({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const uf = (UFS as readonly string[]).includes(sp.uf ?? '') ? sp.uf! : '';
  const cat = (SPORT_GROUPS as string[]).includes(sp.cat ?? '') ? (sp.cat as SportGroup) : null;
  const modo = sp.modo === 'online' || sp.modo === 'presencial' ? sp.modo : '';
  const cidade = (sp.cidade ?? '').trim();
  const q = (sp.q ?? '').trim();
  const soAbertas = sp.abertas === '1';

  const supabase = await createClient();
  let query = supabase.from('championships').select(LISTING_SELECT).eq('visibility', 'publico');
  if (uf) query = query.eq('state', uf);
  if (cidade) query = query.ilike('city', likeTerm(cidade));
  if (q) query = query.ilike('name', likeTerm(q));
  if (cat) query = query.in('sport', sportsIn(cat).map(([k]) => k));
  if (modo) query = query.eq('online', modo === 'online');
  const { data } = await query.order('created_at', { ascending: false }).limit(150).returns<ListingRow[]>();

  let items = toListing(data ?? []);
  if (soAbertas) items = items.filter(c => c.status === 'abertas');
  const arenas = await arenasByOwner(supabase, items.map(c => c.owner_id));

  // Cidades para sugerir no campo (as que têm campeonato público no estado escolhido)
  const { data: cityRows } = uf
    ? await supabase.from('championships').select('city').eq('visibility', 'publico').eq('state', uf).neq('city', '').limit(500).returns<Array<{ city: string }>>()
    : { data: [] as Array<{ city: string }> };
  const cities = [...new Set((cityRows ?? []).map(r => r.city))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filtered = !!(uf || cidade || q || cat || modo || soAbertas);
  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams(Object.entries({ q, uf, cidade, cat: cat ?? '', modo, abertas: soAbertas ? '1' : '', ...patch }).filter(([, v]) => v) as Array<[string, string]>);
    return `/campeonatos${p.size ? `?${p}` : ''}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Campeonatos</h1>
          <p className="sub" style={{ margin: 0 }}>Encontre um campeonato para o seu time jogar.</p>
        </div>
      </div>

      <nav className="chips" aria-label="Categorias">
        <Link href={link({ cat: '' })} className={`tab ${!cat ? 'on' : ''}`}>Todos</Link>
        {SPORT_GROUPS.map(g => <Link key={g} href={link({ cat: g })} className={`tab ${cat === g ? 'on' : ''}`}>{g}</Link>)}
      </nav>

      <form className="card filters" method="get" action="/campeonatos">
        {cat && <input type="hidden" name="cat" value={cat} />}
        <div className="f-q"><label htmlFor="q">Nome</label><input id="q" name="q" className="inp" defaultValue={q} placeholder="Ex.: Copa Verão" /></div>
        <div className="f-uf">
          <label htmlFor="uf">Estado</label>
          <select id="uf" name="uf" className="inp" defaultValue={uf}>
            <option value="">Todos</option>
            {UFS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="f-city">
          <label htmlFor="cidade">Cidade</label>
          <input id="cidade" name="cidade" className="inp" defaultValue={cidade} list="cidades" placeholder="Qualquer cidade" />
          <datalist id="cidades">{cities.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="f-modo">
          <label htmlFor="modo">Onde</label>
          <select id="modo" name="modo" className="inp" defaultValue={modo}>
            <option value="">Presencial e online</option>
            <option value="presencial">Presencial</option>
            <option value="online">Online</option>
          </select>
        </div>
        <label className="f-open"><input type="checkbox" name="abertas" value="1" defaultChecked={soAbertas} /> Só com inscrições abertas</label>
        <div className="f-actions">
          <button className="btn">Filtrar</button>
          {filtered && <Link href="/campeonatos" className="btn ghost">Limpar</Link>}
        </div>
      </form>

      <p className="sub small" style={{ margin: '16px 0 10px' }}>
        {items.length ? `${items.length} campeonato${items.length > 1 ? 's' : ''}` : ''}
      </p>
      {items.length ? (
        <div className="grid-cards">{items.map(c => <ChampCard key={c.id} c={c} organizer={arenas.get(c.owner_id)} />)}</div>
      ) : (
        <div className="card empty">
          {filtered ? 'Nenhum campeonato com esses filtros.' : 'Ainda não há campeonatos públicos.'}
          <div className="actions" style={{ justifyContent: 'center' }}>
            {filtered && <Link href="/campeonatos" className="btn ghost sm">Ver todos</Link>}
            <Link href="/painel/novo" className="btn sm">Criar um campeonato</Link>
          </div>
        </div>
      )}
      <p className="sub small" style={{ marginTop: 20 }}>Aparecem aqui os campeonatos que o organizador marcou como públicos.</p>
    </>
  );
}
