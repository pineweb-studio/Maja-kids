// Banco Cloudflare D1 (SQLite). As tabelas são criadas sozinhas na primeira chamada,
// do mesmo jeito que o servidor em C fazia "ao ligar". Dinheiro sempre em centavos
// (número inteiro) e datas sempre em AAAA-MM-DD.

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY,
    expira INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tentativas_login (
    ip TEXT NOT NULL,
    quando INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS tentativas_ip ON tentativas_login (ip, quando)`,
  `CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_nome TEXT NOT NULL,
    documento TEXT NOT NULL DEFAULT '',
    telefone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    endereco_residencial TEXT NOT NULL DEFAULT '',
    endereco_montagem TEXT NOT NULL DEFAULT '',
    tipo_evento TEXT NOT NULL DEFAULT 'aberto',
    data TEXT NOT NULL,
    hora_inicio TEXT NOT NULL DEFAULT '',
    hora_fim TEXT NOT NULL DEFAULT '',
    taxa_entrega INTEGER NOT NULL DEFAULT 0,
    observacoes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'aguardando',
    motivo_cancelamento TEXT NOT NULL DEFAULT '',
    valor_retido INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','-3 hours'))
  )`,
  `CREATE INDEX IF NOT EXISTS reservas_data ON reservas (data)`,
  `CREATE TABLE IF NOT EXISTS reserva_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id INTEGER NOT NULL,
    brinquedo TEXT NOT NULL,
    valor INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'locado'
  )`,
  `CREATE INDEX IF NOT EXISTS itens_reserva ON reserva_itens (reserva_id)`,
  `CREATE TABLE IF NOT EXISTS reserva_pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    valor INTEGER NOT NULL,
    forma TEXT NOT NULL DEFAULT '',
    lancamento_id INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS pagamentos_reserva ON reserva_pagamentos (reserva_id)`,
  `CREATE TABLE IF NOT EXISTS lancamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    data TEXT NOT NULL,
    valor INTEGER NOT NULL,
    categoria TEXT NOT NULL DEFAULT '',
    descricao TEXT NOT NULL DEFAULT '',
    brinquedo TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now','-3 hours'))
  )`,
  `CREATE INDEX IF NOT EXISTS lancamentos_data ON lancamentos (data)`,
  `CREATE TABLE IF NOT EXISTS precos (
    brinquedo TEXT PRIMARY KEY,
    valor INTEGER NOT NULL DEFAULT 0
  )`,
  // Custo de compra de cada brinquedo (para o ROI)
  `CREATE TABLE IF NOT EXISTS custos_compra (
    brinquedo TEXT PRIMARY KEY,
    valor INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS orcamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_nome TEXT NOT NULL,
    telefone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    evento_data TEXT NOT NULL DEFAULT '',
    evento_tipo TEXT NOT NULL DEFAULT '',
    endereco TEXT NOT NULL DEFAULT '',
    taxa_entrega INTEGER NOT NULL DEFAULT 0,
    desconto INTEGER NOT NULL DEFAULT 0,
    validade TEXT NOT NULL DEFAULT '',
    condicoes TEXT NOT NULL DEFAULT '',
    observacoes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'rascunho',
    origem TEXT NOT NULL DEFAULT 'painel',
    lancamento_id INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','-3 hours'))
  )`,
  `CREATE TABLE IF NOT EXISTS orcamento_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orcamento_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    brinquedo TEXT NOT NULL DEFAULT '',
    quantidade INTEGER NOT NULL DEFAULT 1,
    valor INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS orc_itens ON orcamento_itens (orcamento_id)`,
  `CREATE TABLE IF NOT EXISTS pedidos_site (
    ip TEXT NOT NULL,
    quando INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS manutencoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brinquedo TEXT NOT NULL,
    inicio TEXT NOT NULL,
    previsao TEXT NOT NULL DEFAULT '',
    defeito TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta',
    fim TEXT NOT NULL DEFAULT '',
    reserva_id INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','-3 hours'))
  )`,
  `CREATE TABLE IF NOT EXISTS manutencao_custos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brinquedo TEXT NOT NULL,
    manutencao_id INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    valor INTEGER NOT NULL,
    descricao TEXT NOT NULL DEFAULT '',
    lancamento_id INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    data TEXT NOT NULL,
    hora_inicio TEXT NOT NULL DEFAULT '',
    hora_fim TEXT NOT NULL DEFAULT '',
    local TEXT NOT NULL DEFAULT '',
    capacidade INTEGER NOT NULL DEFAULT 0,
    descricao TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planejamento'
  )`,
  `CREATE TABLE IF NOT EXISTS ingressos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    preco INTEGER NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS promocoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    valor INTEGER NOT NULL,
    qtd_minima INTEGER NOT NULL DEFAULT 1,
    valido_ate TEXT NOT NULL DEFAULT '',
    max_usos INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id INTEGER NOT NULL,
    ingresso_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    comprador TEXT NOT NULL,
    contato TEXT NOT NULL DEFAULT '',
    preco_unit INTEGER NOT NULL,
    desconto INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL,
    promocao_id INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    lancamento_id INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','-3 hours'))
  )`,
  `CREATE TABLE IF NOT EXISTS despesas_fixas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL,
    valor INTEGER NOT NULL,
    dia INTEGER NOT NULL DEFAULT 1,
    a_cada INTEGER NOT NULL DEFAULT 1,
    inicio TEXT NOT NULL,
    ativa INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','-3 hours'))
  )`,
  `CREATE TABLE IF NOT EXISTS despesas_fixas_lancadas (
    despesa_id INTEGER NOT NULL,
    mes TEXT NOT NULL,
    lancamento_id INTEGER NOT NULL,
    PRIMARY KEY (despesa_id, mes)
  )`
];

let pronto = null;
export function prepararBanco(env) {
  if (!env.DB) throw new ErroPainel(500, "O banco D1 não está ligado ao projeto (variável DB). Veja o passo a passo no README.");
  if (!pronto) {
    pronto = env.DB.batch(TABELAS.map(sql => env.DB.prepare(sql))).catch(e => { pronto = null; throw e; });
  }
  return pronto;
}

export class ErroPainel extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

export function json(dados, status = 200, extra = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}

// Data e hora de Brasília (UTC-3, sem horário de verão desde 2019)
export function hojeBR() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/* ===== Validação de campos (regra PineWeb de verificação de dados) ===== */
export function texto(v, max = 200) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}
export function dataISO(v, campo = "data") {
  const s = texto(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s + "T00:00:00Z"))) throw new ErroPainel(400, `Data inválida em "${campo}".`);
  return s;
}
export function hora(v) {
  const s = texto(v, 5);
  if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new ErroPainel(400, "Horário inválido.");
  return s;
}
export function centavos(v, campo = "valor") {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100000000) throw new ErroPainel(400, `Valor inválido em "${campo}".`);
  return n;
}
export function idNum(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ErroPainel(400, "Identificador inválido.");
  return n;
}

export function inteiro(v, campo, min = 0, max = 1000000) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErroPainel(400, `Número inválido em "${campo}".`);
  return n;
}
export function mesISO(v, campo = "mês") {
  const s = texto(v, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new ErroPainel(400, `Mês inválido em "${campo}".`);
  return s;
}
export function umDe(v, lista, campo) {
  const s = texto(v, 40);
  if (!lista.includes(s)) throw new ErroPainel(400, `Opção inválida em "${campo}".`);
  return s;
}
// Lança no financeiro e devolve o id do lançamento
export async function lancar(env, { tipo, data, valor, categoria, descricao = "", brinquedo = "" }) {
  const r = await env.DB.prepare("INSERT INTO lancamentos (tipo, data, valor, categoria, descricao, brinquedo) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
    .bind(tipo, data, valor, categoria, descricao.slice(0, 200), brinquedo).first();
  return r.id;
}
export function somarDias(iso, dias) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
