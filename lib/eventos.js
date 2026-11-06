// Eventos próprios da Maja Kids: ingressos, promoções e vendas (cada venda vira entrada no financeiro).
import { ErroPainel, texto, dataISO, hora, centavos, idNum, inteiro, umDe, hojeBR, lancar } from "./banco.js";

const SITUACOES = ["planejamento", "vendas", "encerrado"];
const TIPOS_PROMO = ["percentual", "valor", "leve-pague"];

export async function lista(env) {
  const [ev, ing, pro, ven] = await Promise.all([
    env.DB.prepare("SELECT * FROM eventos ORDER BY data DESC LIMIT 100").all(),
    env.DB.prepare("SELECT * FROM ingressos ORDER BY id").all(),
    env.DB.prepare("SELECT * FROM promocoes ORDER BY id").all(),
    env.DB.prepare("SELECT * FROM vendas ORDER BY id DESC LIMIT 2000").all()
  ]);
  for (const e of ev.results) {
    e.ingressos = ing.results.filter(i => i.evento_id === e.id);
    e.promocoes = pro.results.filter(p => p.evento_id === e.id);
    e.vendas = ven.results.filter(v => v.evento_id === e.id);
    for (const i of e.ingressos) i.vendidos = e.vendas.filter(v => v.ingresso_id === i.id).reduce((s, v) => s + v.quantidade, 0);
    for (const p of e.promocoes) p.usos = e.vendas.filter(v => v.promocao_id === p.id).length;
    e.vendidos = e.vendas.reduce((s, v) => s + v.quantidade, 0);
    e.receita = e.vendas.reduce((s, v) => s + v.total, 0);
  }
  return { eventos: ev.results };
}

export async function salvar(env, c) {
  const nome = texto(c.nome, 120);
  if (nome.length < 3) throw new ErroPainel(400, "Dê um nome ao evento.");
  const d = {
    nome, data: dataISO(c.data), hora_inicio: hora(c.hora_inicio), hora_fim: hora(c.hora_fim),
    local: texto(c.local, 200), capacidade: inteiro(c.capacidade || 0, "capacidade", 0, 100000),
    descricao: texto(c.descricao, 1000), status: umDe(c.status || "planejamento", SITUACOES, "situação")
  };
  const cols = Object.keys(d);
  if (c.id) {
    const id = idNum(c.id);
    await env.DB.prepare(`UPDATE eventos SET ${cols.map(k => k + " = ?").join(", ")} WHERE id = ?`).bind(...cols.map(k => d[k]), id).run();
    return { id };
  }
  const r = await env.DB.prepare(`INSERT INTO eventos (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) RETURNING id`).bind(...cols.map(k => d[k])).first();
  return { id: r.id };
}

export async function remover(env, c) {
  const id = idNum(c.id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM lancamentos WHERE id IN (SELECT lancamento_id FROM vendas WHERE evento_id = ?)").bind(id),
    env.DB.prepare("DELETE FROM vendas WHERE evento_id = ?").bind(id),
    env.DB.prepare("DELETE FROM promocoes WHERE evento_id = ?").bind(id),
    env.DB.prepare("DELETE FROM ingressos WHERE evento_id = ?").bind(id),
    env.DB.prepare("DELETE FROM eventos WHERE id = ?").bind(id)
  ]);
  return { ok: true };
}

export async function ingresso(env, c) {
  const nome = texto(c.nome, 80);
  if (nome.length < 2) throw new ErroPainel(400, "Dê um nome ao ingresso (ex.: 1 hora).");
  const preco = centavos(c.preco, "preço"), quantidade = inteiro(c.quantidade || 0, "quantidade", 0, 100000);
  const ativo = c.ativo === false ? 0 : 1;
  if (c.id) {
    await env.DB.prepare("UPDATE ingressos SET nome = ?, preco = ?, quantidade = ?, ativo = ? WHERE id = ?").bind(nome, preco, quantidade, ativo, idNum(c.id)).run();
    return { ok: true };
  }
  const evento_id = idNum(c.evento_id);
  await env.DB.prepare("INSERT INTO ingressos (evento_id, nome, preco, quantidade, ativo) VALUES (?, ?, ?, ?, ?)").bind(evento_id, nome, preco, quantidade, ativo).run();
  return { ok: true };
}

export async function ingressoRemover(env, c) {
  const id = idNum(c.id);
  const v = await env.DB.prepare("SELECT COUNT(*) AS n FROM vendas WHERE ingresso_id = ?").bind(id).first();
  if (v.n) throw new ErroPainel(400, "Esse ingresso já tem vendas. Desative em vez de apagar.");
  await env.DB.prepare("DELETE FROM ingressos WHERE id = ?").bind(id).run();
  return { ok: true };
}

export async function promocao(env, c) {
  const nome = texto(c.nome, 80);
  if (nome.length < 2) throw new ErroPainel(400, "Dê um nome à promoção.");
  const tipo = umDe(c.tipo, TIPOS_PROMO, "tipo");
  // percentual: 1 a 100 (%); valor: centavos por ingresso; leve-pague: ingressos grátis a cada "qtd_minima"
  const valor = tipo === "percentual" ? inteiro(c.valor, "porcentagem", 1, 100) : tipo === "valor" ? centavos(c.valor, "desconto") : inteiro(c.valor, "ingressos grátis", 1, 100);
  const qtd_minima = inteiro(c.qtd_minima || 1, "mínimo de ingressos", 1, 1000);
  if (tipo === "leve-pague" && valor >= qtd_minima) throw new ErroPainel(400, "Os ingressos grátis precisam ser menos que o mínimo (ex.: leve 3, pague 2 = mínimo 3, grátis 1).");
  const valido_ate = c.valido_ate ? dataISO(c.valido_ate, "validade") : "";
  const max_usos = inteiro(c.max_usos || 0, "limite de usos", 0, 100000);
  const ativo = c.ativo === false ? 0 : 1;
  if (c.id) {
    await env.DB.prepare("UPDATE promocoes SET nome = ?, tipo = ?, valor = ?, qtd_minima = ?, valido_ate = ?, max_usos = ?, ativo = ? WHERE id = ?")
      .bind(nome, tipo, valor, qtd_minima, valido_ate, max_usos, ativo, idNum(c.id)).run();
    return { ok: true };
  }
  await env.DB.prepare("INSERT INTO promocoes (evento_id, nome, tipo, valor, qtd_minima, valido_ate, max_usos, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(idNum(c.evento_id), nome, tipo, valor, qtd_minima, valido_ate, max_usos, ativo).run();
  return { ok: true };
}

export async function promocaoRemover(env, c) {
  const id = idNum(c.id);
  const v = await env.DB.prepare("SELECT COUNT(*) AS n FROM vendas WHERE promocao_id = ?").bind(id).first();
  if (v.n) throw new ErroPainel(400, "Essa promoção já foi usada. Desative em vez de apagar.");
  await env.DB.prepare("DELETE FROM promocoes WHERE id = ?").bind(id).run();
  return { ok: true };
}

export function calcularDesconto(p, preco, q) {
  if (!p) return 0;
  if (p.tipo === "percentual") return Math.round(preco * q * p.valor / 100);
  if (p.tipo === "valor") return Math.min(preco, p.valor) * q;
  return Math.floor(q / p.qtd_minima) * p.valor * preco; // leve-pague
}

export async function vender(env, c) {
  const evento_id = idNum(c.evento_id), ingresso_id = idNum(c.ingresso_id);
  const quantidade = inteiro(c.quantidade, "quantidade", 1, 1000);
  const comprador = texto(c.comprador, 120);
  if (comprador.length < 3) throw new ErroPainel(400, "Escreva o nome do comprador.");
  const contato = texto(c.contato, 60);
  const data = c.data ? dataISO(c.data) : hojeBR();
  const [ev, ing] = await Promise.all([
    env.DB.prepare("SELECT * FROM eventos WHERE id = ?").bind(evento_id).first(),
    env.DB.prepare("SELECT * FROM ingressos WHERE id = ? AND evento_id = ?").bind(ingresso_id, evento_id).first()
  ]);
  if (!ev) throw new ErroPainel(404, "Evento não encontrado.");
  if (ev.status !== "vendas") throw new ErroPainel(400, "Abra as vendas do evento antes de vender (situação \"Vendas abertas\").");
  if (!ing || !ing.ativo) throw new ErroPainel(400, "Ingresso indisponível.");
  const vend = await env.DB.prepare("SELECT COALESCE(SUM(quantidade),0) AS total, COALESCE(SUM(CASE WHEN ingresso_id = ? THEN quantidade END),0) AS deste FROM vendas WHERE evento_id = ?").bind(ingresso_id, evento_id).first();
  if (ing.quantidade && vend.deste + quantidade > ing.quantidade) throw new ErroPainel(400, `Só restam ${ing.quantidade - vend.deste} ingressos "${ing.nome}".`);
  if (ev.capacidade && vend.total + quantidade > ev.capacidade) throw new ErroPainel(400, `O evento só tem mais ${ev.capacidade - vend.total} vagas.`);

  let promo = null;
  if (c.promocao_id) {
    promo = await env.DB.prepare("SELECT * FROM promocoes WHERE id = ? AND evento_id = ?").bind(idNum(c.promocao_id), evento_id).first();
    if (!promo || !promo.ativo) throw new ErroPainel(400, "Promoção indisponível.");
    if (promo.valido_ate && promo.valido_ate < data) throw new ErroPainel(400, "Essa promoção já venceu.");
    if (quantidade < promo.qtd_minima) throw new ErroPainel(400, `Essa promoção precisa de pelo menos ${promo.qtd_minima} ingressos.`);
    if (promo.max_usos) {
      const u = await env.DB.prepare("SELECT COUNT(*) AS n FROM vendas WHERE promocao_id = ?").bind(promo.id).first();
      if (u.n >= promo.max_usos) throw new ErroPainel(400, "Essa promoção já atingiu o limite de usos.");
    }
  }
  const desconto = calcularDesconto(promo, ing.preco, quantidade);
  const total = Math.max(0, ing.preco * quantidade - desconto);
  const lid = total ? await lancar(env, { tipo: "entrada", data, valor: total, categoria: "evento", descricao: `${ev.nome} - ${quantidade}x ${ing.nome} - ${comprador.slice(0, 60)}` }) : 0;
  await env.DB.prepare(`INSERT INTO vendas (evento_id, ingresso_id, quantidade, comprador, contato, preco_unit, desconto, total, promocao_id, data, lancamento_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(evento_id, ingresso_id, quantidade, comprador, contato, ing.preco, desconto, total, promo ? promo.id : 0, data, lid).run();
  return { ok: true, total, desconto };
}

export async function cancelarVenda(env, c) {
  const v = await env.DB.prepare("SELECT * FROM vendas WHERE id = ?").bind(idNum(c.id)).first();
  if (!v) throw new ErroPainel(404, "Venda não encontrada.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM lancamentos WHERE id = ?").bind(v.lancamento_id),
    env.DB.prepare("DELETE FROM vendas WHERE id = ?").bind(v.id)
  ]);
  return { ok: true };
}
