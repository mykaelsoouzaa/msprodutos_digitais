import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Dot, Flash, GamesList, TableTab, Tabs } from '@/components/champ';
import { roleIn } from '@/lib/access';
import { loadChampionship } from '@/lib/data';
import SportIcon from '@/components/SportIcon';
import { FORMATS, allowsOnline, sportLabel } from '@/lib/domain/sports';
import { isDecided, labels } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { brl, placeLabel, waLink } from '@/lib/format';
import PlaceFields from '@/components/PlaceFields';
import { createClient } from '@/lib/supabase/server';
import { addHelper, deleteChampionship, markPaidManually, removeHelper, setCaptainEmail, updatePlace, updateVisibility } from '../actions';

export const metadata: Metadata = { title: 'Campeonato' };
export const dynamic = 'force-dynamic';

const TABS: Array<[string, string]> = [['jogos', 'Jogos'], ['tabela', 'Tabela'], ['times', 'Times e inscrições'], ['compartilhar', 'Compartilhar'], ['ajustes', 'Ajustes']];

export default async function Campeonato({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await loadChampionship(supabase, { id }, { withContacts: true });
  const role = data ? await roleIn(supabase, data.row, user) : null;
  if (!data || !role) notFound();
  const owner = role === 'dono';
  const tabs = owner ? TABS : TABS.slice(0, 2);

  const { champ, teams, games, players } = data;
  const tab = tabs.some(t => t[0] === sp.aba) ? sp.aba! : 'jogos';
  const { data: helpers } = owner && tab === 'ajustes'
    ? await supabase.from('championship_helpers').select('email').eq('championship_id', id).order('created_at').returns<Array<{ email: string }>>()
    : { data: [] as Array<{ email: string }> };
  const helperInvite = `Você foi convidado para lançar os resultados do ${champ.name} na Campia.\nEntre com este e-mail: ${siteUrl()}/entrar?voltar=${encodeURIComponent(`/painel/${id}`)}`;
  const base = `/painel/${id}`;
  const publicUrl = `${siteUrl()}/c/${champ.slug}`;
  const signupUrl = `${publicUrl}/inscricao`;
  const done = games.filter(isDecided).length;
  const signed = teams.filter(t => t.status === 'inscrita');
  const received = teams.filter(t => t.paid).length * champ.feeCents;

  return (
    <>
      <h1>{champ.name}</h1>
      <p className="sub" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}><SportIcon sport={champ.sport} size={16} plain />{sportLabel(champ.sport)} · {FORMATS[champ.format]}{placeLabel(champ) ? ` · ${placeLabel(champ)}` : ''}</p>
      <div className="actions" style={{ marginTop: 0 }}><Link href={`/c/${champ.slug}`} className="btn ghost sm" target="_blank">👁 Página pública</Link></div>
      <div className="stats">
        <div className="stat"><b>{signed.length}/{teams.length}</b><span>times inscritos</span></div>
        <div className="stat"><b>{done}/{games.length}</b><span>jogos</span></div>
        {owner && <div className="stat"><b className="money">{brl(received)}</b><span>recebido</span></div>}
      </div>
      {!owner && <div className="note" style={{ margin: '0 0 16px' }}>Você é <b>ajudante</b> deste campeonato: pode lançar resultados e ajustar data, horário e campo dos jogos.</div>}
      <Flash ok={sp.ok} erro={sp.erro} />
      <Tabs items={tabs} current={tab} base={base} />

      {tab === 'jogos' && (
        <>
          <p className="sub">Toque num jogo para lançar o resultado ou mudar data, horário e campo.</p>
          <GamesList games={games} teams={teams} hrefFor={g => (g.homeId && g.awayId ? `${base}/jogo/${g.id}` : undefined)} />
        </>
      )}

      {tab === 'tabela' && <TableTab champ={champ} games={games} teams={teams} />}

      {tab === 'times' && (
        <>
          <div className="card">
            <b>Link de inscrição</b>
            <p className="sub" style={{ margin: '4px 0 8px' }}>Cada capitão cadastra o time e paga {brl(champ.feeCents)} pelo PIX. A vaga é confirmada sozinha.</p>
            <div className="copybox">{signupUrl}</div>
            <div className="actions">
              <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `🏆 Inscrições abertas: ${champ.name}\n${sportLabel(champ.sport)} · ${FORMATS[champ.format]}\n💰 ${brl(champ.feeCents)} por time (PIX)\n${champ.online ? '🌐 Online\n' : placeLabel(champ) ? `📍 ${placeLabel(champ)}\n` : ''}Inscreva seu time: ${signupUrl}`)}>Divulgar no WhatsApp</a>
            </div>
          </div>
          <h2>Vagas</h2>
          <div className="card">
            {teams.map(t => {
              const n = players.filter(p => p.teamId === t.id).length;
              return (
                <div className="row" key={t.id}>
                  <Dot team={t} />
                  <div className="grow">
                    <b>{t.name}{t.group ? ` · Grupo ${t.group}` : ''}</b>
                    <span>{t.status === 'aberta' ? 'Aguardando inscrição pelo link' : `${n} atleta${n === 1 ? '' : 's'} · cap. ${t.captainName}${t.captainPhone ? ` · ${t.captainPhone}` : ''}`}</span>
                    {t.status !== 'aberta' && (
                      <details className="mini-edit">
                        <summary>{t.captainEmail ? `✉ ${t.captainEmail}` : '✉ Cadastrar e-mail do capitão'}</summary>
                        <form action={setCaptainEmail} className="mini-form">
                          <input type="hidden" name="championship" value={id} /><input type="hidden" name="team" value={t.id} />
                          <input name="email" type="email" className="inp" defaultValue={t.captainEmail} placeholder="capitao@exemplo.com" aria-label="E-mail do capitão" />
                          <button className="btn sm">Salvar</button>
                        </form>
                      </details>
                    )}
                  </div>
                  {t.status === 'inscrita' && <span className="badge ok">Pago</span>}
                  {t.status === 'aberta' && <span className="badge open">Vaga</span>}
                  {t.status === 'reservada' && (
                    <form action={markPaidManually} style={{ display: 'flex', gap: 6 }}>
                      <input type="hidden" name="championship" value={id} /><input type="hidden" name="team" value={t.id} />
                      {t.captainPhone && <a className="btn wa sm" target="_blank" rel="noopener" href={waLink(t.captainPhone, `Olá, ${t.captainName}! Falta o pagamento da inscrição do ${t.name} no ${champ.name} (${brl(champ.feeCents)}).`)}>Cobrar</a>}
                      <button className="btn ghost sm" title="Recebi por fora">Confirmar</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
          <p className="sub small" style={{ marginTop: 8 }}>Vagas reservadas sem pagamento voltam a ficar livres depois de 30 minutos.</p>
        </>
      )}

      {tab === 'compartilhar' && (
        <>
          <p className="sub">Artes no formato de stories (1080×1920) para o grupo do WhatsApp e o Instagram.</p>
          {labels(games).filter(l => games.some(g => g.label === l && isDecided(g))).map(l => (
            <div className="card" key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="grow"><b>{l}</b><span>Resultados e classificação</span></div>
              <a className="btn sm" href={`/c/${champ.slug}/arte?rodada=${encodeURIComponent(l)}`} target="_blank">Abrir arte</a>
              <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `📊 ${champ.name} · ${l}\nTabela completa: ${publicUrl}`)}>Enviar</a>
            </div>
          ))}
          {!games.some(isDecided) && <div className="card empty">Lance o primeiro resultado para gerar as artes.</div>}
        </>
      )}

      {tab === 'ajustes' && (
        <div className="stack">
          <form action={updateVisibility} className="card">
            <input type="hidden" name="championship" value={id} />
            <b>Quem pode ver</b>
            <div className="choice" style={{ marginTop: 10 }}>
              <label><input type="radio" name="visibility" value="link" defaultChecked={champ.visibility === 'link'} /> 🔗 Só com o link</label>
              <label><input type="radio" name="visibility" value="publico" defaultChecked={champ.visibility === 'publico'} /> 🌎 Público</label>
            </div>
            <div className="actions"><button className="btn sm">Salvar</button></div>
          </form>
          <form action={updatePlace} className={`card ${allowsOnline(champ.sport) ? 'esports' : ''}`}>
            <input type="hidden" name="championship" value={id} />
            <b>Local</b>
            <PlaceFields mode={allowsOnline(champ.sport) ? 'esports' : 'presencial'} online={champ.online} location={champ.location} city={champ.city} state={champ.state} />
            <div className="actions"><button className="btn sm">Salvar local</button></div>
          </form>
          <div className="card">
            <b>Ajudantes</b>
            <p className="sub" style={{ margin: '4px 0 10px' }}>Pessoas que podem lançar resultados e ajustar horários, sem ver pagamentos, contatos ou ajustes. Elas entram na Campia com o e-mail cadastrado aqui.</p>
            {helpers?.map(h => (
              <form action={removeHelper} className="row helper-row" key={h.email}>
                <input type="hidden" name="championship" value={id} /><input type="hidden" name="email" value={h.email} />
                <span className="grow"><b style={{ fontWeight: 600 }}>{h.email}</b></span>
                <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', helperInvite)}>Enviar convite</a>
                <button className="btn ghost sm" aria-label={`Remover ${h.email}`}>Remover</button>
              </form>
            ))}
            <form action={addHelper} className="mini-form" style={{ marginTop: 10 }}>
              <input type="hidden" name="championship" value={id} />
              <input name="email" type="email" className="inp" required placeholder="email@do-ajudante.com" aria-label="E-mail do ajudante" />
              <button className="btn sm">Adicionar</button>
            </form>
          </div>
          <form action={deleteChampionship} className="card">
            <input type="hidden" name="championship" value={id} />
            <b>Excluir campeonato</b>
            <p className="sub" style={{ margin: '4px 0 8px' }}>Apaga times, jogos e resultados. Não dá para desfazer. Digite EXCLUIR para confirmar.</p>
            <input name="confirm" className="inp" placeholder="EXCLUIR" />
            <div className="actions"><button className="btn danger sm">Excluir</button></div>
          </form>
        </div>
      )}
    </>
  );
}
