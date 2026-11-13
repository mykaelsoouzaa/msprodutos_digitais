// Banco SQLite nativo do Node. Uma conta por e-mail que entra pelo portal.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = DatabaseSync;

const ESQUEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contas (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  plano TEXT NOT NULL DEFAULT 'teste',
  criado_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS config_conta (
  conta_id INTEGER PRIMARY KEY REFERENCES contas(id) ON DELETE CASCADE,
  shopee_app_id TEXT NOT NULL DEFAULT '',
  shopee_segredo TEXT NOT NULL DEFAULT '',
  amazon_tag TEXT NOT NULL DEFAULT '',
  ml_modelo TEXT NOT NULL DEFAULT '',
  modelo_mensagem TEXT NOT NULL DEFAULT '',
  intervalo_min INTEGER NOT NULL DEFAULT 25,
  intervalo_max INTEGER NOT NULL DEFAULT 70,
  auto_publicar INTEGER NOT NULL DEFAULT 0,
  desconto_minimo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS instancias (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  chave TEXT NOT NULL UNIQUE,         -- nome da instância na Evolution API
  token_webhook TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'desconectado',
  numero TEXT NOT NULL DEFAULT '',
  criado_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS grupos (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  instancia_id INTEGER NOT NULL REFERENCES instancias(id) ON DELETE CASCADE,
  jid TEXT NOT NULL,
  nome TEXT NOT NULL,
  participantes INTEGER NOT NULL DEFAULT 0,
  enviar INTEGER NOT NULL DEFAULT 0,
  monitorar INTEGER NOT NULL DEFAULT 0,
  atualizado_em INTEGER NOT NULL,
  UNIQUE (instancia_id, jid)
);

CREATE TABLE IF NOT EXISTS ofertas (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL,
  url_original TEXT NOT NULL,
  url_afiliado TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT '',
  imagem TEXT NOT NULL DEFAULT '',
  preco_de INTEGER,                    -- centavos
  preco_por INTEGER,
  comissao_pct REAL,
  origem TEXT NOT NULL DEFAULT 'manual',
  origem_grupo TEXT NOT NULL DEFAULT '',
  criado_em INTEGER NOT NULL,
  UNIQUE (conta_id, url_original)
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  oferta_id INTEGER REFERENCES ofertas(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  imagem TEXT NOT NULL DEFAULT '',
  quando INTEGER NOT NULL,
  grupos TEXT NOT NULL,                -- JSON com ids, ou "todos"
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | enviando | enviado | erro | cancelado
  criado_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS envios (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  agendamento_id INTEGER NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  instancia_id INTEGER NOT NULL,
  enviar_em INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'fila',  -- fila | enviado | erro
  enviado_em INTEGER,
  erro TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS envios_fila ON envios (status, enviar_em);

CREATE TABLE IF NOT EXISTS cupons (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  plataforma TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  validade TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS membros_eventos (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,                  -- entrou | saiu
  qtd INTEGER NOT NULL DEFAULT 1,
  em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comissoes (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL,
  pedido TEXT NOT NULL,
  produto TEXT NOT NULL DEFAULT '',
  valor_centavos INTEGER NOT NULL DEFAULT 0,
  comissao_centavos INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | concluido | cancelado
  em INTEGER NOT NULL,
  UNIQUE (conta_id, plataforma, pedido, produto)
);

CREATE TABLE IF NOT EXISTS acessos_usados (
  jti TEXT PRIMARY KEY,
  expira_em INTEGER NOT NULL
);

-- v2: link curto próprio para contar cliques por oferta e por grupo.
CREATE TABLE IF NOT EXISTS links (
  codigo TEXT PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  oferta_id INTEGER REFERENCES ofertas(id) ON DELETE SET NULL,
  grupo_id INTEGER REFERENCES grupos(id) ON DELETE SET NULL,
  agendamento_id INTEGER REFERENCES agendamentos(id) ON DELETE SET NULL,
  destino TEXT NOT NULL,
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cliques (
  id INTEGER PRIMARY KEY,
  codigo TEXT NOT NULL REFERENCES links(codigo) ON DELETE CASCADE,
  conta_id INTEGER NOT NULL,
  em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cliques_conta ON cliques (conta_id, em);
CREATE INDEX IF NOT EXISTS cliques_codigo ON cliques (codigo);
CREATE INDEX IF NOT EXISTS links_conta ON links (conta_id, criado_em);

-- v5: mensagens recorrentes e histórico de preço.
CREATE TABLE IF NOT EXISTS recorrentes (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  texto TEXT NOT NULL,
  hora TEXT NOT NULL,
  dias TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  ultimo TEXT NOT NULL DEFAULT '',
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS precos (
  id INTEGER PRIMARY KEY,
  oferta_id INTEGER NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  preco_por INTEGER NOT NULL,
  em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS precos_oferta ON precos (oferta_id, em);

-- v6: respostas automáticas no privado e visitas da página de vendas.
CREATE TABLE IF NOT EXISTS respostas (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  palavras TEXT NOT NULL,
  texto TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  usos INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS respostas_envios (
  resposta_id INTEGER NOT NULL REFERENCES respostas(id) ON DELETE CASCADE,
  contato TEXT NOT NULL,
  em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS respostas_envios_contato ON respostas_envios (resposta_id, contato, em);
CREATE TABLE IF NOT EXISTS site_acessos (
  id INTEGER PRIMARY KEY,
  tipo TEXT NOT NULL,                  -- visita | teste | demo
  origem TEXT NOT NULL DEFAULT '',
  plano TEXT NOT NULL DEFAULT '',
  em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS site_acessos_em ON site_acessos (em);

-- v3: link de entrada inteligente (página da bio que manda para o grupo com vaga).
CREATE TABLE IF NOT EXISTS entradas (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  cor TEXT NOT NULL DEFAULT '#e8457c',
  foto TEXT NOT NULL DEFAULT '',
  aviso_afiliado INTEGER NOT NULL DEFAULT 1,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entradas_temas (
  id INTEGER PRIMARY KEY,
  entrada_id INTEGER NOT NULL REFERENCES entradas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS entradas_grupos (
  tema_id INTEGER NOT NULL REFERENCES entradas_temas(id) ON DELETE CASCADE,
  grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tema_id, grupo_id)
);
CREATE TABLE IF NOT EXISTS entradas_acessos (
  id INTEGER PRIMARY KEY,
  entrada_id INTEGER NOT NULL REFERENCES entradas(id) ON DELETE CASCADE,
  tema_id INTEGER,
  grupo_id INTEGER,
  tipo TEXT NOT NULL,                  -- visita | clique | lotado
  origem TEXT NOT NULL DEFAULT '',
  em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS entradas_acessos_em ON entradas_acessos (entrada_id, em);

-- v10: espelhamento de grupos
CREATE TABLE IF NOT EXISTS espelhos (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  origem_grupo_id INTEGER NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  destino TEXT NOT NULL DEFAULT 'tema',  -- tema | todos | grupos
  grupos TEXT NOT NULL DEFAULT '[]',
  ativo INTEGER NOT NULL DEFAULT 1,
  so_com_link INTEGER NOT NULL DEFAULT 1,
  curadoria INTEGER NOT NULL DEFAULT 0,
  rodape INTEGER NOT NULL DEFAULT 1,
  atraso_min INTEGER NOT NULL DEFAULT 0,
  remover TEXT NOT NULL DEFAULT '',
  copiadas INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL,
  UNIQUE (conta_id, origem_grupo_id)
);
CREATE TABLE IF NOT EXISTS espelho_log (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  espelho_id INTEGER NOT NULL REFERENCES espelhos(id) ON DELETE CASCADE,
  em INTEGER NOT NULL,
  status TEXT NOT NULL,                  -- agendada | bloqueada | ignorada
  motivo TEXT NOT NULL DEFAULT '',
  resumo TEXT NOT NULL DEFAULT '',
  agendamento_id INTEGER,
  hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS espelho_log_conta ON espelho_log (conta_id, em);
CREATE TABLE IF NOT EXISTS insta_contas (
  conta_id INTEGER PRIMARY KEY REFERENCES contas(id) ON DELETE CASCADE,
  ig_id TEXT NOT NULL,                 -- id da conta profissional (o mesmo que vem no webhook)
  usuario TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL,                 -- token de longa duração (60 dias, renovado sozinho)
  token_em INTEGER NOT NULL,
  conectado_em INTEGER NOT NULL,
  erro TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS insta_contas_ig ON insta_contas (ig_id);

CREATE TABLE IF NOT EXISTS insta_regras (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  palavras TEXT NOT NULL,              -- "eu quero, quero, link"
  mensagem TEXT NOT NULL,              -- o que vai no direct ({nome} = @ da pessoa)
  publica TEXT NOT NULL DEFAULT '',    -- respostas no comentário, uma por linha (sorteia uma)
  ativo INTEGER NOT NULL DEFAULT 1,
  respondidas INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS insta_log (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  regra_id INTEGER,
  tipo TEXT NOT NULL,                  -- comentario | direct
  ref TEXT NOT NULL,                   -- id do comentário ou da mensagem
  de_id TEXT NOT NULL,
  de_usuario TEXT NOT NULL DEFAULT '',
  texto TEXT NOT NULL DEFAULT '',
  midia TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,                -- enviada | ignorada | erro
  motivo TEXT NOT NULL DEFAULT '',
  em INTEGER NOT NULL,
  UNIQUE (conta_id, tipo, ref)
);
CREATE INDEX IF NOT EXISTS insta_log_conta ON insta_log (conta_id, em);

CREATE TABLE IF NOT EXISTS midias (
  codigo TEXT PRIMARY KEY,
  conta_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  dados BLOB NOT NULL,
  criado_em INTEGER NOT NULL
);
`;

// Colunas acrescentadas depois da v1 (o banco de quem já usa a v1 recebe na hora de abrir).
const COLUNAS_V2: [string, string, string][] = [
  ['config_conta', 'janela_inicio', 'INTEGER NOT NULL DEFAULT 8'],
  ['config_conta', 'janela_fim', 'INTEGER NOT NULL DEFAULT 22'],
  ['config_conta', 'repeticao_horas', 'INTEGER NOT NULL DEFAULT 24'],
  ['config_conta', 'contar_cliques', 'INTEGER NOT NULL DEFAULT 1'],
  ['config_conta', 'conferir_preco', 'INTEGER NOT NULL DEFAULT 1'],
  ['config_conta', 'horarios_auto', "TEXT NOT NULL DEFAULT ''"],
  ['config_conta', 'ultimo_auto', "TEXT NOT NULL DEFAULT ''"],
  ['config_conta', 'resumo_numero', "TEXT NOT NULL DEFAULT ''"],
  ['config_conta', 'resumo_hora', 'INTEGER NOT NULL DEFAULT 21'],
  ['config_conta', 'ultimo_resumo', "TEXT NOT NULL DEFAULT ''"],
  ['ofertas', 'vitrine', 'INTEGER NOT NULL DEFAULT 0'],
  ['ofertas', 'esgotada', 'INTEGER NOT NULL DEFAULT 0'],
  ['ofertas', 'vitrine_em', 'INTEGER NOT NULL DEFAULT 0'],
  ['agendamentos', 'obs', "TEXT NOT NULL DEFAULT ''"],
  ['agendamentos', 'origem', "TEXT NOT NULL DEFAULT 'manual'"],
  ['grupos', 'convite', "TEXT NOT NULL DEFAULT ''"],
  ['grupos', 'limite', 'INTEGER NOT NULL DEFAULT 1000'],
  // v4: nicho e curadoria
  ['config_conta', 'nicho', "TEXT NOT NULL DEFAULT ''"],
  ['ofertas', 'categoria', "TEXT NOT NULL DEFAULT ''"],
  ['ofertas', 'nota', 'REAL'],
  ['ofertas', 'vendas', 'INTEGER'],
  // v5
  ['config_conta', 'aquecimento', 'INTEGER NOT NULL DEFAULT 1'],
  ['config_conta', 'pausado', 'INTEGER NOT NULL DEFAULT 0'],
  ['config_conta', 'boas_vindas', "TEXT NOT NULL DEFAULT ''"],
  ['config_conta', 'boas_vindas_min', 'INTEGER NOT NULL DEFAULT 60'],
  ['config_conta', 'arquivar_dias', 'INTEGER NOT NULL DEFAULT 0'],
  ['config_conta', 'meta_comissao', 'INTEGER NOT NULL DEFAULT 0'],
  ['config_conta', 'resumo_semanal', 'INTEGER NOT NULL DEFAULT 0'],
  ['config_conta', 'ultimo_semanal', "TEXT NOT NULL DEFAULT ''"],
  ['grupos', 'bv_pendente', 'INTEGER NOT NULL DEFAULT 0'],
  ['grupos', 'bv_ultimo', 'INTEGER NOT NULL DEFAULT 0'],
  ['ofertas', 'arquivada', 'INTEGER NOT NULL DEFAULT 0'],
  // v6
  ['agendamentos', 'enquete', "TEXT NOT NULL DEFAULT ''"],
  ['config_conta', 'abastecer', "TEXT NOT NULL DEFAULT ''"],
  ['config_conta', 'ultimo_abastecer', "TEXT NOT NULL DEFAULT ''"],
  ['config_conta', 'lista_dia', "TEXT NOT NULL DEFAULT ''"],
  ['config_conta', 'ultima_lista', "TEXT NOT NULL DEFAULT ''"],
  // v10: envio por tema
  ['grupos', 'categorias', "TEXT NOT NULL DEFAULT ''"],
  ['grupos', 'preco_max', 'INTEGER NOT NULL DEFAULT 0'],
];

export function abrirBanco(arquivo: string): DB {
  if (arquivo !== ':memory:') mkdirSync(dirname(arquivo), { recursive: true });
  const db = new DatabaseSync(arquivo);
  db.exec(ESQUEMA);
  for (const [tabela, coluna, tipo] of COLUNAS_V2) {
    const tem = (db.prepare(`PRAGMA table_info(${tabela})`).all() as any[]).some((c) => c.name === coluna);
    if (!tem) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
  }
  return db;
}

export const agora = () => Date.now();

/** Garante a conta (e a configuração) para o e-mail. */
export function contaPorEmail(db: DB, email: string, nome = ''): { id: number; email: string; nome: string; plano: string } {
  const e = email.toLowerCase();
  db.prepare('INSERT OR IGNORE INTO contas (email, nome, criado_em) VALUES (?, ?, ?)').run(e, nome, agora());
  const c = db.prepare('SELECT id, email, nome, plano FROM contas WHERE email = ?').get(e) as any;
  if (nome && !c.nome) db.prepare('UPDATE contas SET nome = ? WHERE id = ?').run(nome, c.id);
  db.prepare('INSERT OR IGNORE INTO config_conta (conta_id) VALUES (?)').run(c.id);
  return { id: Number(c.id), email: c.email, nome: c.nome || nome, plano: c.plano };
}
