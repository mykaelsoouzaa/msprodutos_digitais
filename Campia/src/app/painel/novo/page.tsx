import type { Metadata } from 'next';
import { Flash } from '@/components/champ';
import PlaceFields from '@/components/PlaceFields';
import SportIcon from '@/components/SportIcon';
import { FORMATS, SPORT_GROUPS, sportsIn } from '@/lib/domain/sports';
import { nextEditionName } from '@/lib/edition';
import { createClient } from '@/lib/supabase/server';
import { createChampionship } from '../actions';

export const metadata: Metadata = { title: 'Novo campeonato' };

function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
  return d.toISOString().slice(0, 10);
}

type Source = {
  id: string; name: string; sport: string; format: string; fee_cents: number; online: boolean; location: string; city: string; state: string;
  visibility: string; schedule: { start: string; times: string[]; fields: string[] };
};

/** Nova edição: mesmo campeonato com a agenda uma semana depois do último jogo marcado (ou do próximo sábado). */
async function loadSource(id: string | undefined) {
  if (!id || !/^[0-9a-zA-Z-]{1,40}$/.test(id)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: c } = await supabase.from('championships')
    .select('id, name, sport, format, fee_cents, online, location, city, state, visibility, schedule')
    .eq('id', id).eq('owner_id', user.id).maybeSingle<Source>();
  if (!c) return null;
  const [{ count }, { count: captains }] = await Promise.all([
    supabase.from('teams').select('id', { count: 'exact', head: true }).eq('championship_id', id),
    supabase.from('team_contacts').select('team_id', { count: 'exact', head: true }).eq('championship_id', id).neq('captain_email', ''),
  ]);
  return { c, teams: count ?? 8, captains: captains ?? 0 };
}

export default async function Novo({ searchParams }: { searchParams: Promise<{ erro?: string; de?: string }> }) {
  const sp = await searchParams;
  const src = await loadSource(sp.de);
  const c = src?.c;
  return (
    <div className="narrow">
      <h1>{c ? 'Nova edição' : 'Novo campeonato'}</h1>
      <p className="sub">{c
        ? <>Copiamos formato, valor, local, horários e regras de <b>{c.name}</b>. Confira a data e crie: a tabela nova é gerada na hora.</>
        : 'A tabela e a agenda são geradas automaticamente. Depois é só mandar o link de inscrição.'}</p>
      <Flash erro={sp.erro} />
      <form action={createChampionship} className="card">
        {c && <input type="hidden" name="from" value={c.id} />}
        <label htmlFor="name" style={{ marginTop: 0 }}>Nome</label>
        <input id="name" name="name" className="inp" required minLength={3} maxLength={80} placeholder="Ex.: Copa Verão da Arena" defaultValue={c ? nextEditionName(c.name) : undefined} />

        <fieldset>
          <legend>Esporte</legend>
          {SPORT_GROUPS.map(group => (
            <div key={group}>
              <div className="sport-pick-group">{group}</div>
              <div className="sport-pick">
                {sportsIn(group).map(([key, r]) => (
                  <label key={key}>
                    <input type="radio" name="sport" value={key} defaultChecked={key === (c?.sport ?? 'Futebol society')} required />
                    <SportIcon sport={key} size={18} />{r.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <label htmlFor="format">Formato</label>
        <select id="format" name="format" className="inp" defaultValue={c?.format ?? 'grupos'}>
          {Object.entries(FORMATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <p className="sub small" style={{ margin: '6px 0 0' }}>Pontos corridos: 3 a 16 times · Grupos + mata-mata: 6 a 16 · Mata-mata: 4, 8 ou 16.</p>

        <div className="grid2">
          <div><label htmlFor="teams">Nº de times</label><input id="teams" name="teams" type="number" min={3} max={16} defaultValue={src?.teams ?? 8} className="inp" required /></div>
          <div><label htmlFor="fee">Inscrição (R$)</label><input id="fee" name="fee" type="number" min={0} step="0.01" defaultValue={c ? c.fee_cents / 100 : 300} className="inp" required /></div>
        </div>
        <PlaceFields mode="pick" online={c?.online} location={c?.location} city={c?.city} state={c?.state} />
        <label htmlFor="start">Primeira rodada</label>
        <input id="start" name="start" type="date" className="inp" defaultValue={nextSaturday()} required />
        <div className="grid2">
          <div><label htmlFor="times">Horários (vírgula)</label><input id="times" name="times" className="inp" defaultValue={c?.schedule.times?.join(', ') || '09:00, 10:00'} required /></div>
          <div><label htmlFor="fields">Campos/quadras (vírgula)</label><input id="fields" name="fields" className="inp" defaultValue={c?.schedule.fields?.join(', ') || 'Campo 1, Campo 2'} required /></div>
        </div>
        <fieldset>
          <legend>Quem pode ver</legend>
          <div className="choice">
            <label><input type="radio" name="visibility" value="link" defaultChecked={c?.visibility !== 'publico'} /> 🔗 Só com o link</label>
            <label><input type="radio" name="visibility" value="publico" defaultChecked={c?.visibility === 'publico'} /> 🌎 Público</label>
          </div>
        </fieldset>
        {c && src!.captains > 0 && (
          <label className="inline-check" style={{ marginTop: 16, alignItems: 'flex-start' }}>
            <input type="checkbox" name="invite" value="1" defaultChecked />
            <span>Avisar por e-mail {src!.captains === 1 ? 'o capitão' : `os ${src!.captains} capitães`} da edição anterior que as inscrições abriram</span>
          </label>
        )}
        <div style={{ marginTop: 18 }}><button className="btn block">{c ? 'Criar nova edição' : 'Criar e gerar tabela'}</button></div>
      </form>
    </div>
  );
}
