// Ponto de entrada: lê o .env, abre os bancos (real e demonstração) e sobe o servidor.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const arqEnv = join(import.meta.dirname, '..', '.env');
if (existsSync(arqEnv)) {
  for (const linha of readFileSync(arqEnv, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { lerConfig } = await import('./config.ts');
const { abrirBanco } = await import('./db.ts');
const { semearDemo } = await import('./demo.ts');
const { EvolutionApi, WhatsAppSimulado } = await import('./whatsapp.ts');
const { criarServidor, iniciarRotinas } = await import('./servidor.ts');

const cfg = lerConfig();
if (!cfg.segredoSessao) throw new Error('Defina SEGREDO_SESSAO no .env');
if (!cfg.dev && !cfg.portalChavePublica) console.warn('Aviso: PORTAL_CHAVE_PUBLICA vazia; a entrada pelo portal não vai funcionar.');

const wpp = cfg.evolutionUrl && cfg.evolutionApiKey ? new EvolutionApi(cfg.evolutionUrl, cfg.evolutionApiKey) : new WhatsAppSimulado();
if (!(wpp instanceof EvolutionApi)) console.warn('Aviso: EVOLUTION_URL/EVOLUTION_API_KEY vazios; usando WhatsApp simulado.');

const demoDb = abrirBanco(':memory:');
semearDemo(demoDb);
const app = {
  cfg,
  real: { db: abrirBanco(cfg.arquivoBanco), wpp, f: fetch, urlPublica: cfg.urlPublica },
  demo: { db: demoDb, wpp: new WhatsAppSimulado(), f: fetch, urlPublica: cfg.urlPublica, demo: true },
};

criarServidor(app).listen(cfg.porta, '127.0.0.1', () => {
  console.log(`Ofertix em http://localhost:${cfg.porta}${cfg.dev ? '  (dev: /demo ou /dev-login)' : ''}`);
});
iniciarRotinas(app);
