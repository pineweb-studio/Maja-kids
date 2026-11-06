// Financeiro, despesas fixas, relatórios e a página Semana (alertas).
import { ErroPainel, texto, dataISO, centavos, idNum, inteiro, umDe, mesISO, hojeBR, somarDias, lancar } from "./banco.js";
import { BRINQUEDOS, IDS, nomeDo } from "./brinquedos.js";

const AUTOMATICAS = { reserva: "Reservas", devolucao: "Reservas", orcamento: "Orçamentos", evento: "Eventos", manutencao: "Acervo", despesa_fixa: "Despesas fixas" };

const diasNoMes = mes => new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate();
const mesesEntre = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
function proximoMes(mes) { const [a, m] = mes.split("-").map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`; }

/* ===== Despesas fixas: o servidor lança sozinho cada mês que chegou ===== */
export async function lancarDespesasFixas(env) {
  const mesAtual = hojeBR().slice(0, 7);
  const { results: desp } = await env.DB.prepare("SELECT * FROM despesas_fixas WHERE ativa = 1").all();
  if (!desp.length) return;
  const { results: feitas } = await env.DB.prepare("SELECT despesa_id, mes FROM despesas_fixas_lancadas").all();
  const ja = new Set(feitas.map(f => f.despesa_id + "|" + f.mes));
  for (const d of desp) {
    let mes = d.inicio;
    if (mesesEntre(mes, mesAtual) > 24) mes = mesAtual; // nunca lança mais de 2 anos para trás
    for (let i = 0; i < 30 && mes <= mesAtual; i++, mes = proximoMes(mes)) {
      if (mesesEntre(d.inicio, mes) % d.a_cada !== 0 || ja.has(d.id + "|" + mes)) continue;
      const dia = String(Math.min(d.dia, diasNoMes(mes))).padStart(2, "0");
      // a chave primária (despesa_id, mes) impede lançar duas vezes se duas abas abrirem juntas
      const marca = await env.DB.prepare("INSERT OR IGNORE INTO despesas_fixas_lancadas (despesa_id, mes, lancamento_id) VALUES (?, ?, 0)").bind(d.id, mes).run();
      if (!marca.meta.changes) continue;
      const lid = await lancar(env, { tipo: "saida", data: `${mes}-${dia}`, valor: d.valor, categoria: d.categoria || "despesa_fixa", descricao: `${d.descricao} (despesa fixa)` });
      await env.DB.prepare("UPDATE despesas_fixas_lancadas SET lancamento_id = ? WHERE despesa_id = ? AND mes = ?").bind(lid, d.id, mes).run();
    }
  }
}

export async function despesasLista(env) {
  const { results } = await env.DB.prepare("SELECT * FROM despesas_fixas ORDER BY ativa DESC, descricao").all();
  return { despesas: results };
}

export async function despesaSalvar(env, c) {
  const descricao = texto(c.descricao, 120);
  if (descricao.length < 2) throw new ErroPainel(400, "Descreva a despesa (ex.: Aluguel do galpão).");
  const d = {
    descricao, categoria: texto(c.categoria, 40) || "despesa_fixa", valor: centavos(c.valor, "valor"),
    dia: inteiro(c.dia || 1, "dia do vencimento", 1, 31), a_cada: inteiro(c.a_cada || 1, "repetição", 1, 12),
    inicio: c.inicio ? mesISO(c.inicio, "início") : hojeBR().slice(0, 7), ativa: c.ativa === false ? 0 : 1
  };
  if (![1, 2, 3, 6, 12].includes(d.a_cada)) throw new ErroPainel(400, "Repetição inválida.");
  if (!d.valor) throw new ErroPainel(400, "Escreva o valor.");
  const cols = Object.keys(d);
  if (c.id) {
    await env.DB.prepare(`UPDATE despesas_fixas SET ${cols.map(k => k + " = ?").join(", ")} WHERE id = ?`).bind(...cols.map(k => d[k]), idNum(c.id)).run();
  } else {
    await env.DB.prepare(`INSERT INTO despesas_fixas (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).bind(...cols.map(k => d[k])).run();
  }
  await lancarDespesasFixas(env);
  return { ok: true };
}

// Apagar a despesa fixa para de lançar daqui pra frente; o que já foi lançado continua no financeiro
export async function despesaRemover(env, c) {
  const id = idNum(c.id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM despesas_fixas WHERE id = ?").bind(id),
    env.DB.prepare("DELETE FROM despesas_fixas_lancadas WHERE despesa_id = ?").bind(id)
  ]);
  return { ok: true };
}

/* ===== Financeiro ===== */
function periodo(url) {
  const hoje = hojeBR();
  const de = url.searchParams.get("de") ? dataISO(url.searchParams.get("de"), "de") : hoje.slice(0, 7) + "-01";
  const ate = url.searchParams.get("ate") ? dataISO(url.searchParams.get("ate"), "até") : hoje.slice(0, 7) + "-" + diasNoMes(hoje.slice(0, 7));
  if (ate < de) throw new ErroPainel(400, "A data final é antes da inicial.");
  return { de, ate };
}

export async function lista(env, url) {
  await lancarDespesasFixas(env);
  const { de, ate } = periodo(url);
  const hoje = hojeBR();
  const [lanc, alug, receber] = await Promise.all([
    env.DB.prepare("SELECT * FROM lancamentos WHERE data BETWEEN ? AND ? ORDER BY data DESC, id DESC").bind(de, ate).all(),
    env.DB.prepare(`SELECT i.brinquedo, COUNT(*) AS qtd, SUM(i.valor) AS valor FROM reserva_itens i JOIN reservas r ON r.id = i.reserva_id
                    WHERE r.status != 'cancelada' AND r.data BETWEEN ? AND ? GROUP BY i.brinquedo ORDER BY valor DESC`).bind(de, ate).all(),
    env.DB.prepare(`SELECT r.id, r.cliente_nome, r.data, r.status,
                      r.taxa_entrega + COALESCE((SELECT SUM(valor) FROM reserva_itens WHERE reserva_id = r.id), 0) AS total,
                      COALESCE((SELECT SUM(valor) FROM reserva_pagamentos WHERE reserva_id = r.id), 0) AS pago
                    FROM reservas r WHERE r.status NOT IN ('cancelada','finalizada') AND r.data <= ? ORDER BY r.data`).bind(somarDias(hoje, 30)).all()
  ]);
  const L = lanc.results;
  const soma = (arr, tipo) => arr.filter(l => l.tipo === tipo).reduce((s, l) => s + l.valor, 0);
  const meses = {};
  const cats = { entrada: {}, saida: {} };
  for (const l of L) {
    const m = l.data.slice(0, 7);
    meses[m] = meses[m] || { mes: m, entradas: 0, saidas: 0 };
    meses[m][l.tipo === "entrada" ? "entradas" : "saidas"] += l.valor;
    cats[l.tipo][l.categoria || "outros"] = (cats[l.tipo][l.categoria || "outros"] || 0) + l.valor;
  }
  const pendentes = receber.results.map(r => ({ ...r, falta: r.total - r.pago })).filter(r => r.falta > 0);
  return {
    de, ate,
    totais: { entradas: soma(L, "entrada"), saidas: soma(L, "saida"), saldo: soma(L, "entrada") - soma(L, "saida") },
    lancamentos: L.map(l => ({ ...l, automatico: AUTOMATICAS[l.categoria] || (l.descricao.endsWith("(despesa fixa)") ? "Despesas fixas" : "") })),
    meses: Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes)).map(m => ({ ...m, saldo: m.entradas - m.saidas })),
    categorias: cats,
    alugueis: alug.results.map(a => ({ ...a, nome: nomeDo(a.brinquedo) })),
    receber: {
      proximos: pendentes.filter(r => r.data >= hoje),
      atrasados: pendentes.filter(r => r.data < hoje),
      total: pendentes.reduce((s, r) => s + r.falta, 0)
    }
  };
}

export async function adicionar(env, c) {
  const tipo = umDe(c.tipo, ["entrada", "saida"], "tipo");
  const valor = centavos(c.valor, "valor");
  if (!valor) throw new ErroPainel(400, "Escreva o valor.");
  const brinquedo = texto(c.brinquedo, 40);
  if (brinquedo && !IDS.has(brinquedo)) throw new ErroPainel(400, "Brinquedo desconhecido.");
  let categoria = texto(c.categoria, 40).toLowerCase().replace(/[^a-z0-9à-ú _-]/g, "") || "outros";
  if (AUTOMATICAS[categoria]) categoria = "manual-" + categoria;
  await lancar(env, { tipo, data: c.data ? dataISO(c.data) : hojeBR(), valor, categoria, descricao: texto(c.descricao, 200), brinquedo });
  return { ok: true };
}

export async function remover(env, c) {
  const l = await env.DB.prepare("SELECT * FROM lancamentos WHERE id = ?").bind(idNum(c.id)).first();
  if (!l) throw new ErroPainel(404, "Lançamento não encontrado.");
  const origem = AUTOMATICAS[l.categoria] || (l.descricao.endsWith("(despesa fixa)") ? "Despesas fixas" : "");
  if (origem) throw new ErroPainel(400, `Esse lançamento veio de "${origem}". Apague ou mude por lá para o financeiro continuar batendo.`);
  await env.DB.prepare("DELETE FROM lancamentos WHERE id = ?").bind(l.id).run();
  return { ok: true };
}

/* ===== Relatórios ===== */
export async function relatorios(env, url) {
  const { de, ate } = periodo(url);
  const [fat, loc, porBrinq, receitaTotal, manut, compra] = await Promise.all([
    env.DB.prepare("SELECT substr(data,1,7) AS mes, SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END) AS entradas, SUM(CASE WHEN tipo='saida' THEN valor ELSE 0 END) AS saidas FROM lancamentos WHERE data BETWEEN ? AND ? GROUP BY mes ORDER BY mes").bind(de, ate).all(),
    env.DB.prepare(`SELECT substr(r.data,1,7) AS mes, COUNT(DISTINCT r.id) AS reservas, COUNT(i.id) AS brinquedos FROM reservas r LEFT JOIN reserva_itens i ON i.reserva_id = r.id
                    WHERE r.status != 'cancelada' AND r.data BETWEEN ? AND ? GROUP BY mes ORDER BY mes`).bind(de, ate).all(),
    env.DB.prepare(`SELECT i.brinquedo, COUNT(*) AS qtd, SUM(i.valor) AS valor FROM reserva_itens i JOIN reservas r ON r.id = i.reserva_id
                    WHERE r.status != 'cancelada' AND r.data BETWEEN ? AND ? GROUP BY i.brinquedo`).bind(de, ate).all(),
    // ROI usa todo o histórico, não só o período
    env.DB.prepare(`SELECT i.brinquedo, SUM(i.valor) AS valor, COUNT(*) AS qtd FROM reserva_itens i JOIN reservas r ON r.id = i.reserva_id
                    WHERE r.status != 'cancelada' GROUP BY i.brinquedo`).all(),
    env.DB.prepare("SELECT brinquedo, SUM(valor) AS valor FROM manutencao_custos GROUP BY brinquedo").all(),
    env.DB.prepare("SELECT brinquedo, valor FROM custos_compra").all()
  ]);
  const mapa = (rs) => Object.fromEntries(rs.results.map(r => [r.brinquedo, r]));
  const p = mapa(porBrinq), rt = mapa(receitaTotal), mn = mapa(manut), cp = mapa(compra);
  return {
    de, ate,
    faturamento: fat.results,
    locacoes: loc.results,
    porBrinquedo: BRINQUEDOS.map(b => ({ id: b.id, nome: b.nome, qtd: p[b.id]?.qtd || 0, valor: p[b.id]?.valor || 0 })).sort((a, b) => b.valor - a.valor),
    roi: BRINQUEDOS.map(b => {
      const receita = rt[b.id]?.valor || 0, manutencao = mn[b.id]?.valor || 0, custo = cp[b.id]?.valor || 0;
      return { id: b.id, nome: b.nome, locacoes: rt[b.id]?.qtd || 0, receita, custo, manutencao, lucro: receita - manutencao - custo,
        retorno: custo ? Math.round((receita - manutencao) / custo * 100) : null };
    })
  };
}

/* ===== Semana: alertas e festas dos próximos 7 dias ===== */
export async function semana(env) {
  await lancarDespesasFixas(env);
  const hoje = hojeBR(), em7 = somarDias(hoje, 7), em3 = somarDias(hoje, 3);
  const [res, itens, man, orc] = await Promise.all([
    env.DB.prepare(`SELECT r.*, r.taxa_entrega + COALESCE((SELECT SUM(valor) FROM reserva_itens WHERE reserva_id = r.id), 0) AS total,
                      COALESCE((SELECT SUM(valor) FROM reserva_pagamentos WHERE reserva_id = r.id), 0) AS pago
                    FROM reservas r WHERE r.status NOT IN ('cancelada','finalizada') OR r.data BETWEEN ? AND ? ORDER BY r.data, r.hora_inicio`).bind(hoje, em7).all(),
    env.DB.prepare(`SELECT i.*, r.data, r.status AS rstatus, r.cliente_nome FROM reserva_itens i JOIN reservas r ON r.id = i.reserva_id
                    WHERE r.status != 'cancelada' AND (r.data >= ? OR i.status = 'defeito')`).bind(hoje).all(),
    env.DB.prepare("SELECT * FROM manutencoes").all(),
    env.DB.prepare("SELECT id, cliente_nome, status, origem, validade, criado_em FROM orcamentos WHERE status IN ('rascunho','enviado')").all()
  ]);
  const A = [];
  const add = (nivel, texto, link) => A.push({ nivel, texto, link });
  const R = res.results;
  for (const r of R) {
    const falta = r.total - r.pago, nome = r.cliente_nome, d = r.data.slice(8) + "/" + r.data.slice(5, 7);
    const link = "reservas?abrir=" + r.id + "&mes=" + r.data.slice(0, 7);
    if (["aguardando", "confirmada"].includes(r.status) && r.data < hoje) add("urgente", `A festa de ${nome} (${d}) já passou e a reserva ainda está como ${r.status === "aguardando" ? "Aguardando sinal" : "Confirmada"}.`, link);
    if (r.status === "entregue" && r.data < hoje) add("urgente", `Brinquedos ainda com ${nome} (festa de ${d}): falta recolher.`, link);
    if (r.status === "recolhida") add("atencao", `Reserva de ${nome} (${d}) recolhida sem a baixa total.`, link);
    if (r.status === "confirmada" && r.pago < Math.ceil(r.total / 2)) add("urgente", `Reserva de ${nome} (${d}) confirmada sem o sinal de 50%.`, link);
    if (["confirmada", "entregue"].includes(r.status) && falta > 0 && r.data >= hoje && r.data <= em3) add("atencao", `Restante de ${nome} vence com a festa em ${d}: falta receber R$ ${(falta / 100).toFixed(2).replace(".", ",")}.`, link);
    if (r.status === "aguardando" && r.data >= hoje) add("aviso", `Reserva de ${nome} (${d}) aguardando sinal: a data só fica garantida com o sinal.`, link);
  }
  const abertas = man.results.filter(m => m.status === "aberta");
  for (const m of abertas) {
    const festa = itens.results.find(i => i.brinquedo === m.brinquedo && i.data >= hoje && !["finalizada"].includes(i.rstatus));
    if (festa) add("urgente", `${nomeDo(m.brinquedo)} está em manutenção e tem festa marcada em ${festa.data.slice(8)}/${festa.data.slice(5, 7)} (${festa.cliente_nome}).`, "acervo");
    if (m.previsao && m.previsao < hoje) add("atencao", `Previsão de volta de ${nomeDo(m.brinquedo)} da manutenção venceu em ${m.previsao.slice(8)}/${m.previsao.slice(5, 7)}.`, "acervo");
  }
  for (const i of itens.results.filter(i => i.status === "defeito")) {
    const tratado = man.results.some(m => m.brinquedo === i.brinquedo && (m.reserva_id === i.reserva_id || m.inicio >= i.data));
    if (!tratado) add("urgente", `${nomeDo(i.brinquedo)} voltou com defeito da festa de ${i.cliente_nome}. Coloque em manutenção no Acervo.`, "acervo");
  }
  for (const o of orc.results) {
    if (o.origem === "site" && o.status === "rascunho") add("atencao", `Pedido de orçamento novo do site: ${o.cliente_nome}.`, "orcamentos?abrir=" + o.id);
    if (o.status === "enviado" && o.validade && o.validade <= somarDias(hoje, 2)) add("aviso", `Orçamento #${o.id} de ${o.cliente_nome} ${o.validade < hoje ? "venceu" : "vence"} em ${o.validade.slice(8)}/${o.validade.slice(5, 7)}.`, "orcamentos?abrir=" + o.id);
  }
  const ordem = { urgente: 0, atencao: 1, aviso: 2 };
  A.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  const festas = R.filter(r => r.data >= hoje && r.data <= em7 && r.status !== "cancelada").map(r => ({
    id: r.id, cliente_nome: r.cliente_nome, data: r.data, hora_inicio: r.hora_inicio, hora_fim: r.hora_fim, status: r.status,
    endereco_montagem: r.endereco_montagem, telefone: r.telefone, total: r.total, pago: r.pago,
    brinquedos: itens.results.filter(i => i.reserva_id === r.id).map(i => nomeDo(i.brinquedo))
  }));
  return { hoje, alertas: A, festas };
}
