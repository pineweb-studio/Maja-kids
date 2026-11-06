// Reservas: situações, itens, pagamentos e a ligação com o financeiro (lancamentos).
// Situações: aguardando (sinal) -> confirmada -> entregue -> recolhida -> finalizada; ou cancelada.
import { ErroPainel, texto, dataISO, hora, centavos, idNum, hojeBR } from "./banco.js";
import { IDS, nomeDo } from "./brinquedos.js";

export const SITUACOES = ["aguardando", "confirmada", "entregue", "recolhida", "finalizada", "cancelada"];
const MUDANCA_LIVRE = ["aguardando", "confirmada", "entregue", "recolhida"];

async function buscar(env, id) {
  const r = await env.DB.prepare("SELECT * FROM reservas WHERE id = ?").bind(id).first();
  if (!r) throw new ErroPainel(404, "Reserva não encontrada.");
  return r;
}

function exigirAberta(r) {
  if (r.status === "finalizada" || r.status === "cancelada") throw new ErroPainel(400, "Essa reserva já está " + r.status + ". Não dá para mudar.");
}

// Um brinquedo não pode estar em duas reservas ativas na mesma data
async function conferirLivre(env, brinquedo, data, ignorarReserva = 0) {
  const r = await env.DB.prepare(
    `SELECT r.id FROM reserva_itens i JOIN reservas r ON r.id = i.reserva_id
     WHERE i.brinquedo = ? AND r.data = ? AND r.status != 'cancelada' AND r.id != ? LIMIT 1`
  ).bind(brinquedo, data, ignorarReserva).first();
  if (r) throw new ErroPainel(409, `${nomeDo(brinquedo)} já está na reserva #${r.id} nessa data.`);
}

function brinquedoValido(v) {
  const id = texto(v, 40);
  if (!IDS.has(id)) throw new ErroPainel(400, "Brinquedo desconhecido.");
  return id;
}

export async function lista(env, url) {
  const mes = texto(url.searchParams.get("mes"), 7) || hojeBR().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mes)) throw new ErroPainel(400, "Mês inválido.");
  const { results: reservas } = await env.DB.prepare(
    `SELECT * FROM reservas
     WHERE substr(data, 1, 7) = ? OR status IN ('aguardando','confirmada','entregue','recolhida')
     ORDER BY data, hora_inicio`
  ).bind(mes).all();
  if (!reservas.length) return { mes, reservas: [] };
  const ids = reservas.map(r => r.id);
  const marcas = ids.map(() => "?").join(",");
  const [itens, pags] = await Promise.all([
    env.DB.prepare(`SELECT * FROM reserva_itens WHERE reserva_id IN (${marcas}) ORDER BY id`).bind(...ids).all(),
    env.DB.prepare(`SELECT * FROM reserva_pagamentos WHERE reserva_id IN (${marcas}) ORDER BY data, id`).bind(...ids).all()
  ]);
  for (const r of reservas) {
    r.itens = itens.results.filter(i => i.reserva_id === r.id);
    r.pagamentos = pags.results.filter(p => p.reserva_id === r.id);
    r.total = r.taxa_entrega + r.itens.reduce((s, i) => s + i.valor, 0);
    r.pago = r.pagamentos.reduce((s, p) => s + p.valor, 0);
  }
  return { mes, reservas };
}

function camposDaReserva(c) {
  const cliente_nome = texto(c.cliente_nome, 120);
  if (cliente_nome.length < 3) throw new ErroPainel(400, "Escreva o nome completo do cliente.");
  const documento = texto(c.documento, 20).replace(/[^\d./-]/g, "");
  const digitos = documento.replace(/\D/g, "");
  if (digitos && digitos.length !== 11 && digitos.length !== 14) throw new ErroPainel(400, "CPF precisa ter 11 números e CNPJ 14.");
  const telefone = texto(c.telefone, 20);
  if (telefone && telefone.replace(/\D/g, "").length < 10) throw new ErroPainel(400, "Telefone com DDD, por favor.");
  const email = texto(c.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroPainel(400, "E-mail inválido.");
  const tipo_evento = c.tipo_evento === "fechado" ? "fechado" : "aberto";
  const hora_inicio = hora(c.hora_inicio), hora_fim = hora(c.hora_fim);
  return {
    cliente_nome, documento, telefone, email,
    endereco_residencial: texto(c.endereco_residencial, 200),
    endereco_montagem: texto(c.endereco_montagem, 200),
    tipo_evento, data: dataISO(c.data), hora_inicio, hora_fim,
    taxa_entrega: centavos(c.taxa_entrega || 0, "taxa de entrega"),
    observacoes: texto(c.observacoes, 1000)
  };
}

export async function salvar(env, c) {
  const d = camposDaReserva(c);
  const colunas = Object.keys(d);
  if (c.id) {
    const id = idNum(c.id);
    const r = await buscar(env, id);
    exigirAberta(r);
    if (d.data !== r.data) {
      const { results } = await env.DB.prepare("SELECT brinquedo FROM reserva_itens WHERE reserva_id = ?").bind(id).all();
      for (const i of results) await conferirLivre(env, i.brinquedo, d.data, id);
    }
    await env.DB.prepare(`UPDATE reservas SET ${colunas.map(k => k + " = ?").join(", ")} WHERE id = ?`).bind(...colunas.map(k => d[k]), id).run();
    return { id };
  }
  const itens = Array.isArray(c.itens) ? c.itens.slice(0, 30).map(i => ({ brinquedo: brinquedoValido(i.brinquedo), valor: centavos(i.valor || 0) })) : [];
  const vistos = new Set();
  for (const i of itens) {
    if (vistos.has(i.brinquedo)) throw new ErroPainel(400, `${nomeDo(i.brinquedo)} está repetido.`);
    vistos.add(i.brinquedo);
    await conferirLivre(env, i.brinquedo, d.data);
  }
  const nova = await env.DB.prepare(`INSERT INTO reservas (${colunas.join(", ")}) VALUES (${colunas.map(() => "?").join(", ")}) RETURNING id`)
    .bind(...colunas.map(k => d[k])).first();
  if (itens.length) {
    await env.DB.batch(itens.map(i => env.DB.prepare("INSERT INTO reserva_itens (reserva_id, brinquedo, valor) VALUES (?, ?, ?)").bind(nova.id, i.brinquedo, i.valor)));
  }
  return { id: nova.id };
}

export async function mudarStatus(env, c) {
  const id = idNum(c.id);
  const status = texto(c.status, 20);
  if (!MUDANCA_LIVRE.includes(status)) throw new ErroPainel(400, "Para finalizar ou cancelar use os botões próprios.");
  const r = await buscar(env, id);
  exigirAberta(r);
  await env.DB.prepare("UPDATE reservas SET status = ? WHERE id = ?").bind(status, id).run();
  return { id, status };
}

export async function adicionarItem(env, c) {
  const reserva_id = idNum(c.reserva_id);
  const brinquedo = brinquedoValido(c.brinquedo);
  const valor = centavos(c.valor || 0);
  const r = await buscar(env, reserva_id);
  exigirAberta(r);
  const repetido = await env.DB.prepare("SELECT id FROM reserva_itens WHERE reserva_id = ? AND brinquedo = ?").bind(reserva_id, brinquedo).first();
  if (repetido) throw new ErroPainel(400, `${nomeDo(brinquedo)} já está nesta reserva.`);
  await conferirLivre(env, brinquedo, r.data, reserva_id);
  await env.DB.prepare("INSERT INTO reserva_itens (reserva_id, brinquedo, valor) VALUES (?, ?, ?)").bind(reserva_id, brinquedo, valor).run();
  return { ok: true };
}

async function itemDaReserva(env, id) {
  const i = await env.DB.prepare("SELECT i.*, r.status AS rstatus FROM reserva_itens i JOIN reservas r ON r.id = i.reserva_id WHERE i.id = ?").bind(id).first();
  if (!i) throw new ErroPainel(404, "Item não encontrado.");
  exigirAberta({ status: i.rstatus });
  return i;
}

export async function removerItem(env, c) {
  const i = await itemDaReserva(env, idNum(c.id));
  await env.DB.prepare("DELETE FROM reserva_itens WHERE id = ?").bind(i.id).run();
  return { ok: true };
}

export async function baixaItem(env, c) {
  const i = await itemDaReserva(env, idNum(c.id));
  const status = texto(c.status, 20);
  if (!["locado", "devolvido", "defeito"].includes(status)) throw new ErroPainel(400, "Situação do item inválida.");
  await env.DB.prepare("UPDATE reserva_itens SET status = ? WHERE id = ?").bind(status, i.id).run();
  return { ok: true };
}

export async function registrarPagamento(env, c) {
  const reserva_id = idNum(c.reserva_id);
  const valor = centavos(c.valor, "valor do pagamento");
  if (valor === 0) throw new ErroPainel(400, "O pagamento precisa ter valor.");
  const data = c.data ? dataISO(c.data) : hojeBR();
  const forma = texto(c.forma, 30);
  const r = await buscar(env, reserva_id);
  exigirAberta(r);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO lancamentos (tipo, data, valor, categoria, descricao) VALUES ('entrada', ?, ?, 'reserva', ?)")
      .bind(data, valor, `Reserva #${reserva_id} - ${r.cliente_nome.slice(0, 80)}${forma ? " (" + forma + ")" : ""}`),
    env.DB.prepare("INSERT INTO reserva_pagamentos (reserva_id, data, valor, forma, lancamento_id) VALUES (?, ?, ?, ?, last_insert_rowid())")
      .bind(reserva_id, data, valor, forma)
  ]);
  return { ok: true };
}

export async function removerPagamento(env, c) {
  const p = await env.DB.prepare("SELECT p.*, r.status AS rstatus FROM reserva_pagamentos p JOIN reservas r ON r.id = p.reserva_id WHERE p.id = ?").bind(idNum(c.id)).first();
  if (!p) throw new ErroPainel(404, "Pagamento não encontrado.");
  exigirAberta({ status: p.rstatus });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM lancamentos WHERE id = ?").bind(p.lancamento_id),
    env.DB.prepare("DELETE FROM reserva_pagamentos WHERE id = ?").bind(p.id)
  ]);
  return { ok: true };
}

async function totais(env, id) {
  const t = await env.DB.prepare(
    `SELECT r.taxa_entrega + COALESCE((SELECT SUM(valor) FROM reserva_itens WHERE reserva_id = r.id), 0) AS total,
            COALESCE((SELECT SUM(valor) FROM reserva_pagamentos WHERE reserva_id = r.id), 0) AS pago
     FROM reservas r WHERE r.id = ?`
  ).bind(id).first();
  return t;
}

// Baixa total: todo brinquedo ainda "locado" vira "devolvido" e a reserva fica finalizada
export async function finalizar(env, c) {
  const id = idNum(c.id);
  const r = await buscar(env, id);
  exigirAberta(r);
  const { total, pago } = await totais(env, id);
  if (pago < total) {
    const falta = ((total - pago) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    throw new ErroPainel(400, `Ainda falta receber ${falta}. Registre o pagamento antes de finalizar.`);
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE reserva_itens SET status = 'devolvido' WHERE reserva_id = ? AND status = 'locado'").bind(id),
    env.DB.prepare("UPDATE reservas SET status = 'finalizada' WHERE id = ?").bind(id)
  ]);
  return { id, status: "finalizada" };
}

// Cancelar: guarda o motivo e quanto fica retido; o que foi pago acima disso vira devolução no financeiro
export async function cancelar(env, c) {
  const id = idNum(c.id);
  const motivo = texto(c.motivo, 300);
  if (motivo.length < 3) throw new ErroPainel(400, "Escreva o motivo do cancelamento.");
  const r = await buscar(env, id);
  exigirAberta(r);
  const { pago } = await totais(env, id);
  const retido = centavos(c.valor_retido || 0, "valor retido");
  if (retido > pago) throw new ErroPainel(400, "O valor retido não pode ser maior que o que já foi pago.");
  const lotes = [env.DB.prepare("UPDATE reservas SET status = 'cancelada', motivo_cancelamento = ?, valor_retido = ? WHERE id = ?").bind(motivo, retido, id)];
  if (pago > retido) {
    lotes.push(env.DB.prepare("INSERT INTO lancamentos (tipo, data, valor, categoria, descricao) VALUES ('saida', ?, ?, 'devolucao', ?)")
      .bind(hojeBR(), pago - retido, `Devolução da reserva #${id} cancelada - ${r.cliente_nome.slice(0, 80)}`));
  }
  await env.DB.batch(lotes);
  return { id, status: "cancelada" };
}

export async function remover(env, c) {
  const id = idNum(c.id);
  await buscar(env, id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM lancamentos WHERE id IN (SELECT lancamento_id FROM reserva_pagamentos WHERE reserva_id = ?)").bind(id),
    env.DB.prepare("DELETE FROM lancamentos WHERE categoria = 'devolucao' AND descricao LIKE ?").bind(`Devolução da reserva #${id} %`),
    env.DB.prepare("DELETE FROM reserva_pagamentos WHERE reserva_id = ?").bind(id),
    env.DB.prepare("DELETE FROM reserva_itens WHERE reserva_id = ?").bind(id),
    env.DB.prepare("DELETE FROM reservas WHERE id = ?").bind(id)
  ]);
  return { ok: true };
}

// Pública (site): brinquedos ocupados numa data. Não mostra nada do cliente.
export async function disponibilidade(env, url) {
  const data = dataISO(url.searchParams.get("data"));
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT i.brinquedo FROM reserva_itens i JOIN reservas r ON r.id = i.reserva_id
     WHERE r.data = ? AND r.status != 'cancelada'`
  ).bind(data).all();
  return { data, ocupados: results.map(x => x.brinquedo) };
}
