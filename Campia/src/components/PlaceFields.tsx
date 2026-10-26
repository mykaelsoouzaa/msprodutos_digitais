// Campos de local do campeonato. "Online" só aparece para e-sports:
// no formulário de novo campeonato isso é feito só com CSS (:has), sem JavaScript.
import { UFS } from '@/lib/format';

interface Props {
  /** pick: o esporte ainda vai ser escolhido no mesmo formulário; esports/presencial: esporte já definido. */
  mode: 'pick' | 'esports' | 'presencial';
  online?: boolean;
  location?: string;
  city?: string;
  state?: string;
}

export default function PlaceFields({ mode, online = false, location = '', city = '', state = '' }: Props) {
  return (
    <>
      {mode !== 'presencial' && (
        <fieldset className={mode === 'pick' ? 'only-esports' : undefined}>
          <legend>Onde vai ser</legend>
          <div className="choice">
            <label><input type="radio" name="online" value="" defaultChecked={!online} /> 📍 Presencial</label>
            <label><input type="radio" name="online" value="1" defaultChecked={online} /> 🌐 Online</label>
          </div>
        </fieldset>
      )}
      <div className="presencial">
        <label htmlFor="location">Local</label>
        <input id="location" name="location" className="inp" defaultValue={location} maxLength={80} placeholder="Ex.: Arena Central" />
        <div className="city-uf">
          <div><label htmlFor="city">Cidade</label><input id="city" name="city" className="inp" defaultValue={city} maxLength={60} placeholder="Ex.: Campinas" autoComplete="address-level2" /></div>
          <div>
            <label htmlFor="state">Estado</label>
            <select id="state" name="state" className="inp" defaultValue={state}>
              <option value="">UF</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
