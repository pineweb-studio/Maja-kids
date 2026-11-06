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
