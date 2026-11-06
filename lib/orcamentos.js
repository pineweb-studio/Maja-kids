// Orçamentos: rascunho -> enviado -> aprovado / rejeitado.
// Aprovado cria uma entrada no financeiro; se deixar de ser aprovado, a entrada é apagada.
// Pedidos feitos pelo site entram como rascunho com origem "site".
import { ErroPainel, texto, dataISO, centavos, idNum, inteiro, umDe, hojeBR, somarDias, lancar } from "./banco.js";
import { IDS, nomeDo } from "./brinquedos.js";

export const SITUACOES = ["rascunho", "enviado", "aprovado", "rejeitado"];

function totalDe(o, itens) {
  return Math.max(0, o.taxa_entrega - o.desconto + itens.reduce((s, i) => s + i.quantidade * i.valor, 0));
}

export async function lista(env, url) {
  const filtro = texto(url.searchParams.get("filtro"), 20) || "todos";
  let onde = "1=1";
  if (filtro === "abertos") onde = "status IN ('rascunho','enviado')";
  else if (filtro === "site") onde = "origem = 'site'";
  else if (filtro === "aprovados") onde = "status = 'aprovado'";
  else if (filtro === "rejeitados") onde = "status = 'rejeitado'";
  const { results: orcs } = await env.DB.prepare(`SELECT * FROM orcamentos WHERE ${onde} ORDER BY id DESC LIMIT 300`).all();
  if (!orcs.length) return { orcamentos: [] };
  const ids = orcs.map(o => o.id);
  const { results: itens } = await env.DB.prepare(`SELECT * FROM orcamento_itens WHERE orcamento_id IN (${ids.map(() => "?").join(",")}) ORDER BY id`).bind(...ids).all();
  for (const o of orcs) { o.itens = itens.filter(i => i.orcamento_id === o.id); o.total = totalDe(o, o.itens); }
  return { orcamentos: orcs };
}

export async function um(env, url) {
  const id = idNum(url.searchParams.get("id"));
  const o = await env.DB.prepare("SELECT * FROM orcamentos WHERE id = ?").bind(id).first();
  if (!o) throw new ErroPainel(404, "Orçamento não encontrado.");
  const { results } = await env.DB.prepare("SELECT * FROM orcamento_itens WHERE orcamento_id = ? ORDER BY id").bind(id).all();
  o.itens = results; o.total = totalDe(o, results);
  return { orcamento: o };
}

function itensValidos(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, 40).map(i => {
    const brinquedo = texto(i.brinquedo, 40);
    if (brinquedo && !IDS.has(brinquedo)) throw new ErroPainel(400, "Brinquedo desconhecido.");
    const descricao = texto(i.descricao, 150) || (brinquedo ? nomeDo(brinquedo) : "");
    if (!descricao) throw new ErroPainel(400, "Todo item precisa de descrição.");
    return { descricao, brinquedo, quantidade: inteiro(i.quantidade || 1, "quantidade", 1, 999), valor: centavos(i.valor || 0) };
  });
}

export async function salvar(env, c) {
  const cliente_nome = texto(c.cliente_nome, 120);
  if (cliente_nome.length < 3) throw new ErroPainel(400, "Escreva o nome do cliente.");
  const d = {
    cliente_nome,
    telefone: texto(c.telefone, 20),
    email: texto(c.email, 120),
    evento_data: c.evento_data ? dataISO(c.evento_data, "data do evento") : "",
    evento_tipo: texto(c.evento_tipo, 60),
    endereco: texto(c.endereco, 200),
    taxa_entrega: centavos(c.taxa_entrega || 0, "entrega e montagem"),
    desconto: centavos(c.desconto || 0, "desconto"),
    validade: c.validade ? dataISO(c.validade, "validade") : somarDias(hojeBR(), 7),
    condicoes: texto(c.condicoes, 500),
    observacoes: texto(c.observacoes, 1000)
  };
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) throw new ErroPainel(400, "E-mail inválido.");
  const itens = itensValidos(c.itens);
  const cols = Object.keys(d);
  let id;
  if (c.id) {
    id = idNum(c.id);
    const o = await env.DB.prepare("SELECT status FROM orcamentos WHERE id = ?").bind(id).first();
    if (!o) throw new ErroPainel(404, "Orçamento não encontrado.");
    if (o.status === "aprovado") throw new ErroPainel(400, "Orçamento aprovado não pode ser editado. Mude a situação antes.");
    await env.DB.prepare(`UPDATE orcamentos SET ${cols.map(k => k + " = ?").join(", ")} WHERE id = ?`).bind(...cols.map(k => d[k]), id).run();
    await env.DB.prepare("DELETE FROM orcamento_itens WHERE orcamento_id = ?").bind(id).run();
  } else {
    id = (await env.DB.prepare(`INSERT INTO orcamentos (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) RETURNING id`).bind(...cols.map(k => d[k])).first()).id;
  }
  if (itens.length) {
    await env.DB.batch(itens.map(i => env.DB.prepare("INSERT INTO orcamento_itens (orcamento_id, descricao, brinquedo, quantidade, valor) VALUES (?, ?, ?, ?, ?)").bind(id, i.descricao, i.brinquedo, i.quantidade, i.valor)));
  }
  return { id };
}

export async function mudarStatus(env, c) {
  const id = idNum(c.id);
  const status = umDe(c.status, SITUACOES, "situação");
  const o = await env.DB.prepare("SELECT * FROM orcamentos WHERE id = ?").bind(id).first();
  if (!o) throw new ErroPainel(404, "Orçamento não encontrado.");
  if (o.status === status) return { id, status };
  if (status === "aprovado") {
    const { results } = await env.DB.prepare("SELECT * FROM orcamento_itens WHERE orcamento_id = ?").bind(id).all();
    const lid = await lancar(env, { tipo: "entrada", data: hojeBR(), valor: totalDe(o, results), categoria: "orcamento", descricao: `Orçamento #${id} aprovado - ${o.cliente_nome.slice(0, 100)}` });
    await env.DB.prepare("UPDATE orcamentos SET status = ?, lancamento_id = ? WHERE id = ?").bind(status, lid, id).run();
  } else {
    const lotes = [env.DB.prepare("UPDATE orcamentos SET status = ?, lancamento_id = 0 WHERE id = ?").bind(status, id)];
    if (o.lancamento_id) lotes.push(env.DB.prepare("DELETE FROM lancamentos WHERE id = ?").bind(o.lancamento_id));
    await env.DB.batch(lotes);
  }
  return { id, status };
}

export async function remover(env, c) {
  const id = idNum(c.id);
  const o = await env.DB.prepare("SELECT lancamento_id FROM orcamentos WHERE id = ?").bind(id).first();
  if (!o) throw new ErroPainel(404, "Orçamento não encontrado.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM lancamentos WHERE id = ?").bind(o.lancamento_id || 0),
    env.DB.prepare("DELETE FROM orcamento_itens WHERE orcamento_id = ?").bind(id),
    env.DB.prepare("DELETE FROM orcamentos WHERE id = ?").bind(id)
  ]);
  return { ok: true };
}

/* ===== Pedido pelo site (público) =====
   Proteções (regra PineWeb): campo escondido contra robô, validação de novo no servidor,
   limite de 3 pedidos por hora por IP e 30 por dia no total, e Cloudflare Turnstile
   se o segredo TURNSTILE_SECRET estiver configurado. */
const NOME_FALSO = /^(teste|test|asdf|qwe|aaa+|xxx+|abc)\b/i;

export async function pedidoSite(env, request, c) {
  if (texto(c.empresa, 50)) return { ok: true }; // robô preencheu o campo escondido: finge que deu certo
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const agora = Math.floor(Date.now() / 1000);
  const [porIp, total] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM pedidos_site WHERE ip = ? AND quando > ?").bind(ip, agora - 3600).first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM pedidos_site WHERE quando > ?").bind(agora - 86400).first()
  ]);
  if (porIp.n >= 3 || total.n >= 30) throw new ErroPainel(429, "Muitos pedidos agora. Chame a gente no WhatsApp (33) 99975-9056.");

  if (env.TURNSTILE_SECRET) {
    const f = new FormData();
    f.append("secret", env.TURNSTILE_SECRET);
    f.append("response", texto(c.turnstile, 2048));
    f.append("remoteip", ip);
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: f }).then(r => r.json()).catch(() => ({}));
    if (!v.success) throw new ErroPainel(400, "Não conseguimos confirmar que você não é um robô. Tente de novo.");
  }

  const nome = texto(c.nome, 80).replace(/\s+/g, " ");
  if (!/^[\p{L}' .-]+$/u.test(nome) || nome.split(" ").filter(p => p.length > 1).length < 2 || NOME_FALSO.test(nome)) throw new ErroPainel(400, "Escreva seu nome e sobrenome.");
  const tel = texto(c.telefone, 20).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (!/^[1-9]{2}9\d{8}$/.test(tel) || /^(\d)\1+$/.test(tel.slice(2))) throw new ErroPainel(400, "Escreva um celular com DDD, por exemplo (33) 99999-9999.");
  const hoje = hojeBR();
  const data = c.data ? dataISO(c.data, "data da festa") : "";
  if (data && (data < hoje || data > somarDias(hoje, 730))) throw new ErroPainel(400, "Escolha uma data de hoje até 2 anos à frente.");
  const local = texto(c.local, 60);
  const brinquedos = (Array.isArray(c.brinquedos) ? c.brinquedos : []).slice(0, 20).map(b => texto(b, 40)).filter(b => IDS.has(b));
  const { results: precos } = await env.DB.prepare("SELECT brinquedo, valor FROM precos").all();
  const preco = Object.fromEntries(precos.map(p => [p.brinquedo, p.valor]));

  const telFmt = `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}`;
  const novo = await env.DB.prepare(
    `INSERT INTO orcamentos (cliente_nome, telefone, evento_data, endereco, validade, observacoes, origem)
     VALUES (?, ?, ?, ?, ?, ?, 'site') RETURNING id`
  ).bind(nome, telFmt, data, local, somarDias(hoje, 7), "Pedido feito pelo site. Confirme pelo WhatsApp do cliente antes de reservar.").first();
  const lotes = brinquedos.map(b => env.DB.prepare("INSERT INTO orcamento_itens (orcamento_id, descricao, brinquedo, quantidade, valor) VALUES (?, ?, ?, 1, ?)").bind(novo.id, nomeDo(b), b, preco[b] || 0));
  lotes.push(env.DB.prepare("INSERT INTO pedidos_site (ip, quando) VALUES (?, ?)").bind(ip, agora));
  lotes.push(env.DB.prepare("DELETE FROM pedidos_site WHERE quando < ?").bind(agora - 86400 * 2));
  await env.DB.batch(lotes);
  return { ok: true };
}
