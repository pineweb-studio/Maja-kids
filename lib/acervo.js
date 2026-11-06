// Acervo: situação de cada brinquedo por data, manutenção e custos de manutenção.
import { ErroPainel, texto, dataISO, centavos, idNum, hojeBR, lancar } from "./banco.js";
import { BRINQUEDOS, IDS, nomeDo } from "./brinquedos.js";

const brinquedoValido = v => { const id = texto(v, 40); if (!IDS.has(id)) throw new ErroPainel(400, "Brinquedo desconhecido."); return id; };

// Livre, reservado ou em manutenção numa data
export async function consulta(env, url) {
  const data = url.searchParams.get("data") ? dataISO(url.searchParams.get("data")) : hojeBR();
  const [res, man] = await Promise.all([
    env.DB.prepare(`SELECT i.brinquedo, r.id, r.cliente_nome, r.status FROM reserva_itens i JOIN reservas r ON r.id = i.reserva_id
                    WHERE r.data = ? AND r.status != 'cancelada'`).bind(data).all(),
    env.DB.prepare(`SELECT brinquedo, id, defeito, previsao FROM manutencoes
                    WHERE status = 'aberta' AND inicio <= ?`).bind(data).all()
  ]);
  return {
    data,
    brinquedos: BRINQUEDOS.map(b => {
      const m = man.results.find(x => x.brinquedo === b.id);
      const r = res.results.find(x => x.brinquedo === b.id);
      return { id: b.id, nome: b.nome, cat: b.cat,
        situacao: m ? "manutencao" : r ? "reservado" : "livre",
        reserva: r ? { id: r.id, cliente: r.cliente_nome, status: r.status } : null,
        manutencao: m || null };
    })
  };
}

export async function lista(env) {
  const [man, custos, compra] = await Promise.all([
    env.DB.prepare("SELECT * FROM manutencoes ORDER BY status = 'aberta' DESC, inicio DESC LIMIT 200").all(),
    env.DB.prepare("SELECT * FROM manutencao_custos ORDER BY data DESC, id DESC LIMIT 500").all(),
    env.DB.prepare("SELECT * FROM custos_compra").all()
  ]);
  return { manutencoes: man.results, custos: custos.results, compra: Object.fromEntries(compra.results.map(c => [c.brinquedo, c.valor])) };
}

export async function abrir(env, c) {
  const brinquedo = brinquedoValido(c.brinquedo);
  const defeito = texto(c.defeito, 300);
  if (defeito.length < 3) throw new ErroPainel(400, "Descreva o defeito.");
  const inicio = c.inicio ? dataISO(c.inicio, "início") : hojeBR();
  const previsao = c.previsao ? dataISO(c.previsao, "previsão") : "";
  if (previsao && previsao < inicio) throw new ErroPainel(400, "A previsão de volta não pode ser antes do início.");
  const aberta = await env.DB.prepare("SELECT id FROM manutencoes WHERE brinquedo = ? AND status = 'aberta'").bind(brinquedo).first();
  if (aberta) throw new ErroPainel(400, `${nomeDo(brinquedo)} já está em manutenção (#${aberta.id}).`);
  const reserva_id = c.reserva_id ? idNum(c.reserva_id) : 0;
  const r = await env.DB.prepare("INSERT INTO manutencoes (brinquedo, inicio, previsao, defeito, reserva_id) VALUES (?, ?, ?, ?, ?) RETURNING id")
    .bind(brinquedo, inicio, previsao, defeito, reserva_id).first();
  return { id: r.id };
}

export async function editar(env, c) {
  const id = idNum(c.id);
  const defeito = texto(c.defeito, 300);
  if (defeito.length < 3) throw new ErroPainel(400, "Descreva o defeito.");
  const previsao = c.previsao ? dataISO(c.previsao, "previsão") : "";
  await env.DB.prepare("UPDATE manutencoes SET defeito = ?, previsao = ? WHERE id = ?").bind(defeito, previsao, id).run();
  return { id };
}

export async function concluir(env, c) {
  const id = idNum(c.id);
  const fim = c.fim ? dataISO(c.fim, "volta") : hojeBR();
  await env.DB.prepare("UPDATE manutencoes SET status = 'concluida', fim = ? WHERE id = ? AND status = 'aberta'").bind(fim, id).run();
  return { id };
}

export async function remover(env, c) {
  const id = idNum(c.id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM lancamentos WHERE id IN (SELECT lancamento_id FROM manutencao_custos WHERE manutencao_id = ?)").bind(id),
    env.DB.prepare("DELETE FROM manutencao_custos WHERE manutencao_id = ?").bind(id),
    env.DB.prepare("DELETE FROM manutencoes WHERE id = ?").bind(id)
  ]);
  return { ok: true };
}

// Gasto de manutenção: vira uma saída no financeiro
export async function custo(env, c) {
  const brinquedo = brinquedoValido(c.brinquedo);
  const valor = centavos(c.valor, "valor");
  if (!valor) throw new ErroPainel(400, "Escreva o valor do gasto.");
  const data = c.data ? dataISO(c.data) : hojeBR();
  const descricao = texto(c.descricao, 150);
  const manutencao_id = c.manutencao_id ? idNum(c.manutencao_id) : 0;
  const lid = await lancar(env, { tipo: "saida", data, valor, categoria: "manutencao", brinquedo, descricao: `Manutenção ${nomeDo(brinquedo)}${descricao ? " - " + descricao : ""}` });
  await env.DB.prepare("INSERT INTO manutencao_custos (brinquedo, manutencao_id, data, valor, descricao, lancamento_id) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(brinquedo, manutencao_id, data, valor, descricao, lid).run();
  return { ok: true };
}

export async function custoRemover(env, c) {
  const x = await env.DB.prepare("SELECT * FROM manutencao_custos WHERE id = ?").bind(idNum(c.id)).first();
  if (!x) throw new ErroPainel(404, "Gasto não encontrado.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM lancamentos WHERE id = ?").bind(x.lancamento_id),
    env.DB.prepare("DELETE FROM manutencao_custos WHERE id = ?").bind(x.id)
  ]);
  return { ok: true };
}

export async function custoCompra(env, c) {
  const brinquedo = brinquedoValido(c.brinquedo);
  await env.DB.prepare("INSERT INTO custos_compra (brinquedo, valor) VALUES (?, ?) ON CONFLICT(brinquedo) DO UPDATE SET valor = excluded.valor")
    .bind(brinquedo, centavos(c.valor)).run();
  return { ok: true };
}
