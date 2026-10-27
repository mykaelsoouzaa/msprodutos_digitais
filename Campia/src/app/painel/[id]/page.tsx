import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Discipline, Dot, Flash, GamesList, TableTab, Tabs } from '@/components/champ';
import { roleIn } from '@/lib/access';
import { loadChampionship } from '@/lib/data';
import SportIcon from '@/components/SportIcon';
import { FORMATS, allowsOnline, sportLabel, sportRules } from '@/lib/domain/sports';
import { isDecided, labels } from '@/lib/domain/standings';
import { siteUrl } from '@/lib/env';
import { brl, placeLabel, waLink } from '@/lib/format';
import { priceText, todayBr } from '@/lib/pricing';
import { SOURCE_LABEL, type ViewRow, summarize, withOrigin } from '@/lib/visits';
import PlaceFields from '@/components/PlaceFields';
import { createClient } from '@/lib/supabase/server';
import { refundLatePayment } from '../cancel-actions';
import { removeFromWaitlist } from '../waitlist-actions';
import { addSponsor, removeSponsor } from '../sponsor-actions';
import { initials } from '@/lib/arena';
import ProLock from '@/components/ProLock';
import { isProActive } from '@/lib/plan';
import { myPlan } from '@/lib/plan-server';
import { SPONSOR_LIMIT, SPONSOR_SELECT, type Sponsor, sortSponsors } from '@/lib/sponsors';
import { addCoupon, drawChampionship, rebuildChampionship, removeCoupon, setVoting, updateBasics, updatePriceTiers, updateSchedule } from '../edit-actions';
import { type VoteResult, categoriesFor, ranking } from '@/lib/voting';
import { addHelper, updateYellowLimit, deleteChampionship, markPaidManually, removeHelper, setCaptainEmail, updatePlace, updateVisibility } from '../actions';

export const metadata: Metadata = { title: 'Campeonato' };
export const dynamic = 'force-dynamic';

const TABS: Array<[string, string]> = [['jogos', 'Jogos'], ['tabela', 'Tabela'], ['times', 'Times e inscrições'], ['compartilhar', 'Compartilhar'], ['visitas', 'Visitas'], ['ajustes', 'Ajustes']];

export default async function Campeonato({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string; dias?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const data = await loadChampionship(supabase, { id }, { withContacts: true });
  const role = data ? await roleIn(supabase, data.row, user) : null;
  if (!data || !role) notFound();
  const owner = role === 'dono';
  const pro = owner && isProActive(await myPlan(supabase, user!.id));
  const cardTab: Array<[string, string]> = sportRules(data.champ.sport).cards ? [['cartoes', 'Cartões']] : [];
  const tabs = [...TABS.slice(0, 2), ...cardTab, ...(owner ? TABS.slice(2) : [])];

  const { champ, teams, games, players } = data;
  const tab = tabs.some(t => t[0] === sp.aba) ? sp.aba! : 'jogos';
  const { data: helpers } = owner && tab === 'ajustes'
    ? await supabase.from('championship_helpers').select('email').eq('championship_id', id).order('created_at').returns<Array<{ email: string }>>()
    : { data: [] as Array<{ email: string }> };
  const helperInvite = `Você foi convidado para lançar os resultados do ${champ.name} na Campia.\nEntre com este e-mail: ${siteUrl()}/entrar?voltar=${encodeURIComponent(`/painel/${id}`)}`;
  const { data: latePays } = owner && tab === 'times'
    ? await supabase.from('payments').select('id, amount_cents, paid_at, teams(name)').eq('championship_id', id).eq('status', 'pago_tarde')
      .returns<Array<{ id: string; amount_cents: number; paid_at: string | null; teams: { name: string } | null }>>()
    : { data: [] as Array<{ id: string; amount_cents: number; paid_at: string | null; teams: { name: string } | null }> };
  const { data: waitlist } = owner && tab === 'times'
    ? await supabase.from('waitlist').select('id, team_name, captain_name, email, phone, notified_at, created_at').eq('championship_id', id).order('created_at')
      .returns<Array<{ id: string; team_name: string; captain_name: string; email: string; phone: string; notified_at: string | null; created_at: string }>>()
    : { data: [] as Array<{ id: string; team_name: string; captain_name: string; email: string; phone: string; notified_at: string | null; created_at: string }> };
  const { data: coupons } = owner && tab === 'ajustes'
    ? await supabase.from('coupons').select('id, code, percent, amount_cents, max_uses').eq('championship_id', id).order('created_at')
      .returns<Array<{ id: string; code: string; percent: number | null; amount_cents: number | null; max_uses: number | null }>>()
    : { data: [] as Array<{ id: string; code: string; percent: number | null; amount_cents: number | null; max_uses: number | null }> };
  const { data: couponUses } = owner && tab === 'ajustes'
    ? await supabase.from('payments').select('coupon_code').eq('championship_id', id).in('status', ['pago', 'pendente']).not('coupon_code', 'is', null)
      .returns<Array<{ coupon_code: string }>>()
    : { data: [] as Array<{ coupon_code: string }> };
  const { data: sponsorRows } = owner && tab === 'ajustes'
    ? await supabase.from('sponsors').select(SPONSOR_SELECT).eq('championship_id', id).order('created_at').returns<Sponsor[]>()
    : { data: [] as Sponsor[] };
  const sponsors = sortSponsors(sponsorRows ?? []);
  const tiers = [...(champ.priceTiers ?? [])].sort((a, b) => a.until.localeCompare(b.until));
  const { data: voteRows } = owner && tab === 'ajustes' && champ.voting !== 'fechada'
    ? await supabase.rpc('vote_results', { champ: id })
    : { data: [] };
  const votes = (voteRows ?? []) as VoteResult[];
  const days = sp.dias === '7' ? 7 : sp.dias === '90' ? 90 : 30;
  const { data: viewRows } = owner && tab === 'visitas'
    ? await supabase.from('page_views').select('day, page, source, views').eq('championship_id', id).returns<ViewRow[]>()
    : { data: [] as ViewRow[] };
  const visits = summarize(viewRows ?? [], todayBr(), days);
  const peak = Math.max(1, ...visits.daily.map(d => d.views));
  const dm = (day: string) => day.split('-').reverse().slice(0, 2).join('/');
  const base = `/painel/${id}`;
  const publicUrl = `${siteUrl()}/c/${champ.slug}`;
  const signupUrl = `${publicUrl}/inscricao`;
  const done = games.filter(isDecided).length;
  const signed = teams.filter(t => t.status === 'inscrita');
  const { data: paidRows } = owner
    ? await supabase.from('payments').select('amount_cents').eq('championship_id', id).eq('status', 'pago').returns<Array<{ amount_cents: number }>>()
    : { data: [] as Array<{ amount_cents: number }> };
  const received = (paidRows ?? []).reduce((s, p) => s + p.amount_cents, 0);
  const price = priceText(champ.feeCents, champ.priceTiers, brl);

  return (
    <>
      <h1>{champ.name}</h1>
      <p className="sub" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}><SportIcon sport={champ.sport} size={16} plain />{sportLabel(champ.sport)} · {FORMATS[champ.format]}{placeLabel(champ) ? ` · ${placeLabel(champ)}` : ''}</p>
      <div className="actions" style={{ marginTop: 0 }}><Link href={`/c/${champ.slug}`} className="btn ghost sm" target="_blank">👁 Página pública</Link>{owner && <Link href={`/painel/novo?de=${champ.id}`} className="btn ghost sm">⧉ Nova edição</Link>}</div>
      <div className="stats">
        <div className="stat"><b>{signed.length}/{teams.length}</b><span>times inscritos</span></div>
        <div className="stat"><b>{done}/{games.length}</b><span>jogos</span></div>
        {owner && <div className="stat"><b className="money">{brl(received)}</b><span>recebido pelo PIX</span></div>}
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
      {tab === 'cartoes' && <Discipline champ={champ} games={games} cards={data.cards} players={players} teams={teams} />}

      {tab === 'times' && (
        <>
          <div className="card">
            <b>Link de inscrição</b>
            <p className="sub" style={{ margin: '4px 0 8px' }}>Cada capitão cadastra o time e paga {price.long} pelo PIX. A vaga é confirmada sozinha.</p>
            <div className="copybox">{signupUrl}</div>
            <div className="actions">
              <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `🏆 Inscrições abertas: ${champ.name}\n${sportLabel(champ.sport)} · ${FORMATS[champ.format]}\n💰 ${price.long} por time (PIX)\n${champ.online ? '🌐 Online\n' : placeLabel(champ) ? `📍 ${placeLabel(champ)}\n` : ''}Inscreva seu time: ${withOrigin(signupUrl, 'whatsapp')}`)}>Divulgar no WhatsApp</a>
            </div>
          </div>
          {champ.format !== 'pontos' && !games.some(isDecided) && (
            <form action={drawChampionship} className="card draw-card">
              <input type="hidden" name="championship" value={id} />
              <div className="grow">
                <b>🎲 Sortear {champ.format === 'grupos' ? 'os grupos' : 'os confrontos'}</b>
                <span>{champ.rules.drawnAt
                  ? `Último sorteio: ${new Date(champ.rules.drawnAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })}. Pode sortear de novo até o primeiro resultado (a agenda é refeita).`
                  : `Hoje ${champ.format === 'grupos' ? 'os grupos seguem' : 'a chave segue'} a ordem de inscrição. Sorteie depois que as inscrições fecharem (dá para fazer ao vivo). A agenda dos jogos é refeita.`}</span>
              </div>
              <button className="btn sm">{champ.rules.drawnAt ? 'Sortear de novo' : 'Sortear agora'}</button>
            </form>
          )}
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
                  {t.status === 'inscrita' && <Link href={`${base}/time/${t.id}`} className="btn ghost sm">Editar</Link>}
                  {t.status === 'aberta' && <Link href={`${base}/time/${t.id}`} className="btn ghost sm" title="Para quem pagou por fora ou cortesia">Inscrever</Link>}
                  {t.status === 'reservada' && (
                    <form action={markPaidManually} style={{ display: 'flex', gap: 6 }}>
                      <input type="hidden" name="championship" value={id} /><input type="hidden" name="team" value={t.id} />
                      {t.captainPhone && <a className="btn wa sm" target="_blank" rel="noopener" href={waLink(t.captainPhone, `Olá, ${t.captainName}! Falta o pagamento da inscrição do ${t.name} no ${champ.name}.`)}>Cobrar</a>}
                      <button className="btn ghost sm" title="Recebi por fora">Confirmar</button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
          <p className="sub small" style={{ marginTop: 8 }}>Vagas reservadas sem pagamento voltam a ficar livres depois de 30 minutos. Para cancelar uma inscrição e devolver o PIX, clique em Editar.</p>
          {!!waitlist?.length && (
            <>
              <h2>Lista de espera ({waitlist.length})</h2>
              <div className="card">
                <p className="sub" style={{ margin: '0 0 6px' }}>Quando abre vaga, a Campia avisa por e-mail os primeiros da fila. Você também pode chamar pelo WhatsApp.</p>
                {waitlist.map((w, i) => (
                  <form action={removeFromWaitlist} className="row helper-row" key={w.id}>
                    <input type="hidden" name="championship" value={id} /><input type="hidden" name="entry" value={w.id} />
                    <div className="grow"><b>{i + 1}. {w.team_name}</b><span>{[w.captain_name, w.phone, w.email].filter(Boolean).join(' · ')}</span></div>
                    {w.notified_at && <span className="badge ok">Avisado</span>}
                    {w.phone && <a className="btn wa sm" target="_blank" rel="noopener" href={waLink(w.phone, `Olá! Abriu vaga no ${champ.name}. Inscreva o ${w.team_name}: ${signupUrl}`)}>Chamar</a>}
                    <button className="btn ghost sm">Remover</button>
                  </form>
                ))}
              </div>
            </>
          )}
          {!!latePays?.length && (
            <>
              <h2>PIX pagos depois de a vaga expirar</h2>
              <div className="card">
                <p className="sub" style={{ margin: '0 0 6px' }}>Esses times pagaram quando a reserva já tinha vencido e a vaga foi para outro time. Devolva o valor ou encaixe o time numa vaga livre.</p>
                {latePays.map(p => (
                  <form action={refundLatePayment} className="row" key={p.id}>
                    <input type="hidden" name="championship" value={id} /><input type="hidden" name="payment" value={p.id} />
                    <div className="grow"><b>{p.teams?.name ?? 'Time'} · {brl(p.amount_cents)}</b><span>pago em {p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : ''}</span></div>
                    <button className="btn ghost sm">Devolver PIX</button>
                  </form>
                ))}
              </div>
            </>
          )}
          {!pro ? (
            <div style={{ marginTop: 16 }}><ProLock title="Baixar planilhas" text="Times e contatos, atletas, pagamentos e jogos em planilhas que abrem no Excel e no Google Planilhas." /></div>
          ) : (
          <div className="card" style={{ marginTop: 16 }}>
            <b>Baixar planilhas</b>
            <p className="sub" style={{ margin: '4px 0 10px' }}>Abrem no Excel e no Google Planilhas. Úteis para a contabilidade, o seguro dos atletas e a súmula impressa.</p>
            <div className="actions" style={{ marginTop: 0 }}>
              {([['times', 'Times e contatos'], ['atletas', 'Atletas'], ['pagamentos', 'Pagamentos'], ['jogos', 'Jogos e resultados']] as const).map(([k, l]) => (
                <a key={k} href={`${base}/exportar/${k}`} className="btn ghost sm" download>⬇ {l}</a>
              ))}
            </div>
          </div>
          )}
        </>
      )}

      {tab === 'compartilhar' && (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div className="grow"><b>Tabela e jogos para imprimir</b><span>Classificação, jogos, artilharia e cartões numa folha. Dá para salvar em PDF.</span></div>
            <Link className="btn sm" href={`/c/${champ.slug}/imprimir`} target="_blank">Abrir</Link>
          </div>
          <p className="sub">Artes no formato de stories (1080×1920) para o grupo do WhatsApp e o Instagram.</p>
          {labels(games).filter(l => games.some(g => g.label === l && isDecided(g))).map(l => (
            <div className="card" key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="grow"><b>{l}</b><span>Resultados e classificação</span></div>
              <a className="btn sm" href={`/c/${champ.slug}/arte?rodada=${encodeURIComponent(l)}`} target="_blank">Abrir arte</a>
              <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `📊 ${champ.name} · ${l}\nTabela completa: ${withOrigin(publicUrl, 'whatsapp')}`)}>Enviar</a>
            </div>
          ))}
          {!games.some(isDecided) && <div className="card empty">Lance o primeiro resultado para gerar as artes.</div>}
        </>
      )}

      {tab === 'visitas' && owner && !pro && (
        <ProLock title="Estatísticas de visitas" text="Veja quantas pessoas abriram a página por dia, de onde vieram (WhatsApp, Instagram, Google) e quantas foram para a inscrição.">
          <p style={{ margin: '12px 0 0' }}><b>{visits.total}</b> <span className="sub">visita{visits.total === 1 ? '' : 's'} nos últimos 30 dias: a contagem já está rodando, é só assinar para ver os detalhes.</span></p>
        </ProLock>
      )}
      {tab === 'visitas' && owner && pro && (
        <>
          <nav className="chips" aria-label="Período">
            {([['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias']] as const).map(([d, l]) => (
              <Link key={d} href={`${base}?aba=visitas&dias=${d}`} className={`tab ${String(days) === d ? 'on' : ''}`}>{l}</Link>
            ))}
          </nav>
          <div className="stats">
            <div className="stat"><b>{visits.total}</b><span>visitas na página</span></div>
            <div className="stat"><b>{visits.signup}</b><span>abriram a inscrição</span></div>
            <div className="stat"><b>{visits.total ? `${Math.min(100, Math.round((visits.signup / visits.total) * 100))}%` : '–'}</b><span>foram para a inscrição</span></div>
          </div>
          {visits.total === 0 && visits.signup === 0 ? (
            <div className="card empty">
              Nenhuma visita nesse período ainda. Divulgue o link no WhatsApp e no Instagram: as visitas aparecem aqui no mesmo dia.
              <div className="actions" style={{ justifyContent: 'center' }}>
                <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `🏆 ${champ.name}\n${withOrigin(publicUrl, 'whatsapp')}`)}>Divulgar no WhatsApp</a>
              </div>
            </div>
          ) : (
            <div className="stack">
              <div className="card">
                <b>Visitas por dia</b>
                <div className={`vis-bars ${days > 30 ? 'dense' : ''}`} role="img" aria-label={`Visitas por dia nos últimos ${days} dias`}>
                  {visits.daily.map(d => (
                    <div key={d.day} className="vis-bar" title={`${dm(d.day)}: ${d.views} visita${d.views === 1 ? '' : 's'}`}>
                      <i style={{ height: `${Math.max(d.views ? 4 : 0, (d.views / peak) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="vis-axis"><span>{dm(visits.daily[0].day)}</span><span>pico: {peak === 1 && !visits.total ? 0 : peak}/dia</span><span>hoje</span></div>
              </div>
              {visits.sources.length > 0 && (
                <div className="card">
                  <b>De onde vieram</b>
                  <div className="stack" style={{ marginTop: 10 }}>
                    {visits.sources.map(r => (
                      <div key={r.source} className="src-row">
                        <span className="src-name">{SOURCE_LABEL[r.source]}</span>
                        <span className="src-track"><i style={{ width: `${(r.views / visits.total) * 100}%` }} /></span>
                        <span className="src-num">{r.views} · {Math.round((r.views / visits.total) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                  <p className="sub small" style={{ margin: '12px 0 0' }}>Os links de “Divulgar” da Campia já vão marcados como WhatsApp. “Link direto” é quem digitou o endereço ou abriu de um app que não informa a origem.</p>
                </div>
              )}
            </div>
          )}
          <p className="sub small" style={{ marginTop: 14 }}>Conta uma visita cada vez que alguém abre a página (recarregar não soma). Suas próprias visitas e robôs de busca ficam de fora. Não guardamos IP nem dados de quem visitou.</p>
        </>
      )}

      {tab === 'ajustes' && (
        <div className="stack">
          <form action={updateBasics} className="card">
            <input type="hidden" name="championship" value={id} />
            <b>Nome e inscrição</b>
            <div className="grid2">
              <div><label htmlFor="b-name">Nome</label><input id="b-name" name="name" className="inp" required minLength={3} maxLength={80} defaultValue={champ.name} /></div>
              <div><label htmlFor="b-fee">Inscrição (R$)</label><input id="b-fee" name="fee" type="number" min={0} step="0.01" className="inp" defaultValue={(champ.feeCents / 100).toFixed(2)} /></div>
            </div>
            <p className="sub small" style={{ margin: '6px 0 0' }}>O novo valor vale para as próximas inscrições; quem já pagou não muda.</p>
            <div className="actions"><button className="btn sm">Salvar</button></div>
          </form>
          <form action={updatePriceTiers} className="card">
            <input type="hidden" name="championship" value={id} />
            <b>Lotes de preço</b>
            <p className="sub" style={{ margin: '4px 0 0' }}>Valores mais baratos para quem se inscreve antes. Cada lote vale até o fim do dia escolhido; depois do último, vale o valor da inscrição ({brl(champ.feeCents)}). Hoje: <b style={{ color: 'var(--text)' }}>{price.long}</b>.</p>
            {[0, 1, 2].map(i => (
              <div className="grid2" key={i}>
                <div><label htmlFor={`until_${i}`}>{i + 1}º lote até</label><input id={`until_${i}`} name={`until_${i}`} type="date" className="inp" defaultValue={tiers[i]?.until ?? ''} /></div>
                <div><label htmlFor={`value_${i}`}>Valor (R$)</label><input id={`value_${i}`} name={`value_${i}`} type="number" min={0} step="0.01" className="inp" defaultValue={tiers[i] ? (tiers[i].cents / 100).toFixed(2) : ''} /></div>
              </div>
            ))}
            <p className="sub small" style={{ margin: '6px 0 0' }}>Deixe em branco para não usar lotes.</p>
            <div className="actions"><button className="btn sm">Salvar lotes</button></div>
          </form>
          <div className="card">
            <b>Cupons de desconto</b>
            <p className="sub" style={{ margin: '4px 0 10px' }}>O capitão digita o código na inscrição. Bom para times parceiros, quem jogou a edição passada ou divulgação.</p>
            {coupons?.map(c => {
              const used = (couponUses ?? []).filter(u => u.coupon_code === c.code).length;
              return (
                <form action={removeCoupon} className="row helper-row" key={c.id}>
                  <input type="hidden" name="championship" value={id} /><input type="hidden" name="coupon" value={c.id} />
                  <div className="grow"><b>{c.code}</b><span>{c.percent ? `${c.percent}% de desconto` : `${brl(c.amount_cents ?? 0)} de desconto`} · usado {used}{c.max_uses ? ` de ${c.max_uses}` : ''} vez{used === 1 ? '' : 'es'}</span></div>
                  <button className="btn ghost sm">Remover</button>
                </form>
              );
            })}
            <form action={addCoupon} style={{ marginTop: 6 }}>
              <input type="hidden" name="championship" value={id} />
              <div className="grid2">
                <div><label htmlFor="c-code">Código</label><input id="c-code" name="code" className="inp" required maxLength={20} placeholder="PARCEIRO10" style={{ textTransform: 'uppercase' }} /></div>
                <div><label htmlFor="c-max">Limite de usos</label><input id="c-max" name="max" type="number" min={1} className="inp" placeholder="sem limite" /></div>
              </div>
              <div className="grid2">
                <div>
                  <label htmlFor="c-kind">Tipo</label>
                  <select id="c-kind" name="kind" className="inp" defaultValue="percent"><option value="percent">% de desconto</option><option value="valor">R$ de desconto</option></select>
                </div>
                <div><label htmlFor="c-value">Desconto</label><input id="c-value" name="value" type="number" min={0.01} step="0.01" className="inp" required placeholder="10" /></div>
              </div>
              <div className="actions"><button className="btn sm">Criar cupom</button></div>
            </form>
          </div>
          <form action={updateSchedule} className="card">
            <input type="hidden" name="championship" value={id} />
            <b>Agenda</b>
            <p className="sub" style={{ margin: '4px 0 0' }}>Refaz datas, horários e campos dos jogos que ainda não aconteceram (uma rodada por semana).</p>
            <label htmlFor="s-start">Primeira rodada</label>
            <input id="s-start" name="start" type="date" className="inp" required defaultValue={champ.schedule.start} />
            <div className="grid2">
              <div><label htmlFor="s-times">Horários (vírgula)</label><input id="s-times" name="times" className="inp" required defaultValue={champ.schedule.times.join(', ')} /></div>
              <div><label htmlFor="s-fields">Campos/quadras (vírgula)</label><input id="s-fields" name="fields" className="inp" required defaultValue={champ.schedule.fields.join(', ')} /></div>
            </div>
            <div className="actions"><button className="btn sm">Refazer agenda</button></div>
          </form>
          {teams.every(t => t.status === 'aberta') && !games.some(isDecided) && (
            <form action={rebuildChampionship} className="card">
              <input type="hidden" name="championship" value={id} />
              <b>Formato e número de times</b>
              <p className="sub" style={{ margin: '4px 0 0' }}>Só dá para mudar enquanto ninguém se inscreveu. A tabela é gerada de novo.</p>
              <div className="grid2">
                <div>
                  <label htmlFor="r-format">Formato</label>
                  <select id="r-format" name="format" className="inp" defaultValue={champ.format}>
                    {Object.entries(FORMATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </div>
                <div><label htmlFor="r-teams">Nº de times</label><input id="r-teams" name="teams" type="number" min={3} max={16} className="inp" defaultValue={teams.length} /></div>
              </div>
              <div className="actions"><button className="btn sm">Refazer tabela</button></div>
            </form>
          )}
          <div className="card" id="patrocinio">
            <b>🤝 Patrocinadores</b>
            <p className="sub" style={{ margin: '4px 0 10px' }}>Aparecem na página do campeonato, na versão para imprimir e nas artes para os stories. Venda cotas para bancar a premiação: <b>master</b> sai em destaque, <b>apoio</b> menor.</p>
            {sponsors.length > 0 && (
              <div className="stack" style={{ marginBottom: 12 }}>
                {sponsors.map(sp => (
                  <form key={sp.id} action={removeSponsor} className="sponsor-admin">
                    <input type="hidden" name="championship" value={id} />
                    <input type="hidden" name="sponsor" value={sp.id} />
                    <span className={`sponsor ${sp.logo_url ? '' : 'text'}`}>{sp.logo_url ? <img src={sp.logo_url} alt="" /> : initials(sp.name)}</span>
                    <span className="grow"><b>{sp.name}</b> <span className="sub small">· {sp.tier === 'master' ? 'Master' : 'Apoio'}{sp.url ? ` · ${sp.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : ''}</span></span>
                    <button className="btn ghost sm" aria-label={`Remover ${sp.name}`}>Remover</button>
                  </form>
                ))}
              </div>
            )}
            {!pro ? (
              <ProLock title="Recurso do Plano Pro" text={sponsors.length ? 'Seu Pro acabou: os patrocinadores acima não aparecem mais no site até você renovar.' : 'Assine o Pro para mostrar patrocinadores na página, na impressão e nas artes.'} />
            ) : sponsors.length < SPONSOR_LIMIT ? (
              <form action={addSponsor}>
                <input type="hidden" name="championship" value={id} />
                <div className="grid2">
                  <div><label htmlFor="sp-name">Nome</label><input id="sp-name" name="name" className="inp" required minLength={2} maxLength={60} placeholder="Ex.: Padaria Pão Bom" /></div>
                  <div>
                    <label htmlFor="sp-tier">Cota</label>
                    <select id="sp-tier" name="tier" className="inp" defaultValue="apoio"><option value="master">Master (destaque)</option><option value="apoio">Apoio</option></select>
                  </div>
                </div>
                <label htmlFor="sp-url">Site ou Instagram (opcional)</label>
                <input id="sp-url" name="url" className="inp" maxLength={200} placeholder="Ex.: instagram.com/paobom" />
                <label htmlFor="sp-logo">Logo (PNG, JPG ou WEBP até 1 MB, opcional)</label>
                <input id="sp-logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="inp" />
                <div style={{ marginTop: 12 }}><button className="btn sm">Adicionar patrocinador</button></div>
              </form>
            ) : <p className="sub small">Limite de {SPONSOR_LIMIT} patrocinadores atingido.</p>}
          </div>
          <div className="card">
            <b>🏅 Votação do craque</b>
            <p className="sub" style={{ margin: '4px 0 10px' }}>O público vota em {categoriesFor(champ.sport).map(c => c[1].toLowerCase()).join(', ')}, com 1 voto por pessoa (login por e-mail). O resultado só aparece quando você encerrar.</p>
            <div className="actions" style={{ marginTop: 0 }}>
              <span className={`badge ${champ.voting === 'aberta' ? 'ok' : champ.voting === 'encerrada' ? 'wait' : 'open'}`}>{champ.voting === 'aberta' ? 'Aberta' : champ.voting === 'encerrada' ? 'Encerrada' : 'Fechada'}</span>
            </div>
            {champ.voting !== 'fechada' && (
              <div style={{ marginTop: 8 }}>
                {categoriesFor(champ.sport).map(([cat, label]) => {
                  const top = ranking(votes, players, teams, cat);
                  return <p className="sub small" key={cat} style={{ margin: '4px 0' }}><b style={{ color: 'var(--text)' }}>{label}:</b> {top.length ? top.map(r => `${r.player.name} (${r.total})`).join(', ') : 'sem votos'}</p>;
                })}
              </div>
            )}
            <div className="actions">
              {champ.voting !== 'aberta' && <form action={setVoting}><input type="hidden" name="championship" value={id} /><input type="hidden" name="state" value="aberta" /><button className="btn sm">{champ.voting === 'encerrada' ? 'Reabrir votação' : 'Abrir votação'}</button></form>}
              {champ.voting === 'aberta' && <form action={setVoting}><input type="hidden" name="championship" value={id} /><input type="hidden" name="state" value="encerrada" /><button className="btn sm">Encerrar e divulgar resultado</button></form>}
              {champ.voting === 'aberta' && <a className="btn wa sm" target="_blank" rel="noopener" href={waLink('', `🗳 Votação do craque do ${champ.name} aberta! Vote aqui: ${withOrigin(`${publicUrl}?aba=votacao`, 'whatsapp')}`)}>Divulgar</a>}
              {champ.voting !== 'fechada' && <form action={setVoting}><input type="hidden" name="championship" value={id} /><input type="hidden" name="state" value="fechada" /><button className="btn ghost sm">Esconder votação</button></form>}
            </div>
          </div>
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
          {sportRules(champ.sport).cards && (
            <form action={updateYellowLimit} className="card">
              <input type="hidden" name="championship" value={id} />
              <b>Cartões</b>
              <p className="sub" style={{ margin: '4px 0 10px' }}>Vermelho ou 2 amarelos no mesmo jogo suspendem o atleta no próximo jogo. Escolha quantos amarelos acumulados também suspendem.</p>
              <div className="mini-form">
                <select name="yellowLimit" className="inp" defaultValue={String(champ.rules.yellowLimit ?? 3)} aria-label="Amarelos para suspensão">
                  {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n} amarelos = 1 jogo suspenso</option>)}
                </select>
                <button className="btn sm">Salvar</button>
              </div>
            </form>
          )}
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
