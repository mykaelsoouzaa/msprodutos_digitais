import type { Metadata } from 'next';
import { Flash } from '@/components/champ';
import SportIcon from '@/components/SportIcon';
import { FORMATS, SPORT_GROUPS, sportsIn } from '@/lib/domain/sports';
import { createChampionship } from '../actions';

export const metadata: Metadata = { title: 'Novo campeonato' };

function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
  return d.toISOString().slice(0, 10);
}

export default async function Novo({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="narrow">
      <h1>Novo campeonato</h1>
      <p className="sub">A tabela e a agenda são geradas automaticamente. Depois é só mandar o link de inscrição.</p>
      <Flash erro={sp.erro} />
      <form action={createChampionship} className="card">
        <label htmlFor="name" style={{ marginTop: 0 }}>Nome</label>
        <input id="name" name="name" className="inp" required minLength={3} maxLength={80} placeholder="Ex.: Copa Verão da Arena" />

        <fieldset>
          <legend>Esporte</legend>
          {SPORT_GROUPS.map(group => (
            <div key={group}>
              <div className="sport-pick-group">{group}</div>
              <div className="sport-pick">
                {sportsIn(group).map(([key, r]) => (
                  <label key={key}>
                    <input type="radio" name="sport" value={key} defaultChecked={key === 'Futebol society'} required />
                    <SportIcon sport={key} size={18} />{r.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <label htmlFor="format">Formato</label>
        <select id="format" name="format" className="inp" defaultValue="grupos">
          {Object.entries(FORMATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <p className="sub small" style={{ margin: '6px 0 0' }}>Pontos corridos: 3 a 16 times · Grupos + mata-mata: 6 a 16 · Mata-mata: 4, 8 ou 16.</p>

        <div className="grid2">
          <div><label htmlFor="teams">Nº de times</label><input id="teams" name="teams" type="number" min={3} max={16} defaultValue={8} className="inp" required /></div>
          <div><label htmlFor="fee">Inscrição (R$)</label><input id="fee" name="fee" type="number" min={0} step="0.01" defaultValue={300} className="inp" required /></div>
        </div>
        <div className="grid2">
          <div><label htmlFor="location">Local</label><input id="location" name="location" className="inp" placeholder="Ex.: Arena Central" /></div>
          <div><label htmlFor="city">Cidade</label><input id="city" name="city" className="inp" placeholder="Cidade, UF" /></div>
        </div>
        <label htmlFor="start">Primeira rodada</label>
        <input id="start" name="start" type="date" className="inp" defaultValue={nextSaturday()} required />
        <div className="grid2">
          <div><label htmlFor="times">Horários (vírgula)</label><input id="times" name="times" className="inp" defaultValue="09:00, 10:00" required /></div>
          <div><label htmlFor="fields">Campos/quadras (vírgula)</label><input id="fields" name="fields" className="inp" defaultValue="Campo 1, Campo 2" required /></div>
        </div>
        <fieldset>
          <legend>Quem pode ver</legend>
          <div className="choice">
            <label><input type="radio" name="visibility" value="link" defaultChecked /> 🔗 Só com o link</label>
            <label><input type="radio" name="visibility" value="publico" /> 🌎 Público</label>
          </div>
        </fieldset>
        <div style={{ marginTop: 18 }}><button className="btn block">Criar e gerar tabela</button></div>
      </form>
    </div>
  );
}
