import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/champ';
import type { ArenaRow } from '@/lib/arena';
import { siteUrl } from '@/lib/env';
import { UFS } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { saveArena } from './actions';

export const metadata: Metadata = { title: 'Página da arena' };
export const dynamic = 'force-dynamic';

export default async function EditArena({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: a } = await supabase.from('arenas').select('*').eq('owner_id', user!.id).maybeSingle<ArenaRow>();

  return (
    <div className="narrow">
      <Link href="/painel" className="back-link">‹ Seus campeonatos</Link>
      <div className="page-head">
        <div>
          <h1>Página da arena</h1>
          <p className="sub" style={{ margin: 0 }}>Uma página pública com seus dados e todos os seus campeonatos públicos.</p>
        </div>
        {a && <Link href={`/arena/${a.slug}`} className="btn ghost" target="_blank">Ver página</Link>}
      </div>
      <Flash ok={sp.ok} erro={sp.erro} />
      <form action={saveArena} className="card">
        <label htmlFor="name" style={{ marginTop: 0 }}>Nome da arena ou organizador</label>
        <input id="name" name="name" className="inp" required minLength={2} maxLength={80} defaultValue={a?.name} placeholder="Ex.: Arena Central" />

        <label htmlFor="slug">Endereço da página</label>
        <div className="prefixed">
          <span>{siteUrl().replace(/^https?:\/\//, '')}/arena/</span>
          <input id="slug" name="slug" className="inp" maxLength={60} defaultValue={a?.slug} placeholder="arena-central" pattern="[a-zA-Z0-9-]{3,60}" />
        </div>
        <p className="sub small" style={{ margin: '6px 0 0' }}>Deixe em branco para gerar a partir do nome.</p>

        <label htmlFor="logo">Logo</label>
        <div className="logo-field">
          {a?.logo_url ? <img src={a.logo_url} alt="" className="arena-logo sm" /> : <span className="arena-logo sm empty">sem logo</span>}
          <div className="grow">
            <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="inp" />
            <p className="sub small" style={{ margin: '6px 0 0' }}>PNG, JPG ou WEBP, até 1 MB. De preferência quadrado.</p>
            {a?.logo_url && <label className="inline-check"><input type="checkbox" name="removeLogo" value="1" /> Remover logo</label>}
          </div>
        </div>

        <label htmlFor="bio">Sobre</label>
        <textarea id="bio" name="bio" className="inp" maxLength={400} defaultValue={a?.bio} placeholder="Ex.: 4 campos de society com iluminação, vestiário e lanchonete." />

        <label htmlFor="address">Endereço</label>
        <input id="address" name="address" className="inp" maxLength={120} defaultValue={a?.address} placeholder="Rua, número, bairro" />
        <div className="city-uf">
          <div><label htmlFor="city">Cidade</label><input id="city" name="city" className="inp" maxLength={60} defaultValue={a?.city} /></div>
          <div>
            <label htmlFor="state">Estado</label>
            <select id="state" name="state" className="inp" defaultValue={a?.state ?? ''}>
              <option value="">UF</option>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div><label htmlFor="whatsapp">WhatsApp para contato</label><input id="whatsapp" name="whatsapp" className="inp" inputMode="tel" defaultValue={a?.whatsapp} placeholder="(11) 99999-9999" /></div>
          <div><label htmlFor="instagram">Instagram</label><input id="instagram" name="instagram" className="inp" defaultValue={a?.instagram} placeholder="@arenacentral" /></div>
        </div>
        <p className="sub small" style={{ margin: '6px 0 0' }}>O WhatsApp e o Instagram aparecem na página pública como botões de contato.</p>
        <div style={{ marginTop: 18 }}><button className="btn block">{a ? 'Salvar alterações' : 'Criar página da arena'}</button></div>
      </form>
    </div>
  );
}
