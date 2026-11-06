// Todas as rotas do servidor (Cloudflare Pages Functions).
// Públicas:  GET  /api/disponibilidade?data=AAAA-MM-DD  ·  POST /api/pedido-orcamento
// Painel:    /api/admin/...  (todas exigem login, menos /api/admin/login)
import { prepararBanco, json, ErroPainel, texto, centavos } from "../../lib/banco.js";
import * as acesso from "../../lib/acesso.js";
import * as reservas from "../../lib/reservas.js";
import * as orcamentos from "../../lib/orcamentos.js";
import * as acervo from "../../lib/acervo.js";
import * as eventos from "../../lib/eventos.js";
import * as financeiro from "../../lib/financeiro.js";
import { BRINQUEDOS, IDS } from "../../lib/brinquedos.js";

const ROTAS_PAINEL = {
  "GET semana": env => financeiro.semana(env),
  "GET reservas/lista": (env, url) => reservas.lista(env, url),
  "GET reservas/uma": (env, url) => reservas.uma(env, url),
  "GET orcamentos/lista": (env, url) => orcamentos.lista(env, url),
  "GET orcamentos/um": (env, url) => orcamentos.um(env, url),
  "POST orcamentos/salvar": (env, _u, c) => orcamentos.salvar(env, c),
  "POST orcamentos/status": (env, _u, c) => orcamentos.mudarStatus(env, c),
  "POST orcamentos/remover": (env, _u, c) => orcamentos.remover(env, c),
  "GET acervo/consulta": (env, url) => acervo.consulta(env, url),
  "GET acervo/lista": env => acervo.lista(env),
  "POST manutencao/abrir": (env, _u, c) => acervo.abrir(env, c),
  "POST manutencao/editar": (env, _u, c) => acervo.editar(env, c),
  "POST manutencao/concluir": (env, _u, c) => acervo.concluir(env, c),
  "POST manutencao/remover": (env, _u, c) => acervo.remover(env, c),
  "POST manutencao/custo": (env, _u, c) => acervo.custo(env, c),
  "POST manutencao/custo-remover": (env, _u, c) => acervo.custoRemover(env, c),
  "POST brinquedos/custo-compra": (env, _u, c) => acervo.custoCompra(env, c),
  "GET eventos/lista": env => eventos.lista(env),
  "POST eventos/salvar": (env, _u, c) => eventos.salvar(env, c),
  "POST eventos/remover": (env, _u, c) => eventos.remover(env, c),
  "POST eventos/ingresso": (env, _u, c) => eventos.ingresso(env, c),
  "POST eventos/ingresso-remover": (env, _u, c) => eventos.ingressoRemover(env, c),
  "POST eventos/promocao": (env, _u, c) => eventos.promocao(env, c),
  "POST eventos/promocao-remover": (env, _u, c) => eventos.promocaoRemover(env, c),
  "POST eventos/vender": (env, _u, c) => eventos.vender(env, c),
  "POST eventos/cancelar-venda": (env, _u, c) => eventos.cancelarVenda(env, c),
  "GET financeiro/lista": (env, url) => financeiro.lista(env, url),
  "POST financeiro/adicionar": (env, _u, c) => financeiro.adicionar(env, c),
  "POST financeiro/remover": (env, _u, c) => financeiro.remover(env, c),
  "GET despesas/lista": env => financeiro.despesasLista(env),
  "POST despesas/salvar": (env, _u, c) => financeiro.despesaSalvar(env, c),
  "POST despesas/remover": (env, _u, c) => financeiro.despesaRemover(env, c),
  "GET relatorios": (env, url) => financeiro.relatorios(env, url),
  "POST reservas/salvar": (env, _u, c) => reservas.salvar(env, c),
  "POST reservas/status": (env, _u, c) => reservas.mudarStatus(env, c),
  "POST reservas/item": (env, _u, c) => reservas.adicionarItem(env, c),
  "POST reservas/item-remover": (env, _u, c) => reservas.removerItem(env, c),
  "POST reservas/item-baixa": (env, _u, c) => reservas.baixaItem(env, c),
  "POST reservas/pagamento": (env, _u, c) => reservas.registrarPagamento(env, c),
  "POST reservas/pagamento-remover": (env, _u, c) => reservas.removerPagamento(env, c),
  "POST reservas/finalizar": (env, _u, c) => reservas.finalizar(env, c),
  "POST reservas/cancelar": (env, _u, c) => reservas.cancelar(env, c),
  "POST reservas/remover": (env, _u, c) => reservas.remover(env, c),
  "GET brinquedos": async env => {
    const [p, c] = await Promise.all([env.DB.prepare("SELECT brinquedo, valor FROM precos").all(), env.DB.prepare("SELECT brinquedo, valor FROM custos_compra").all()]);
    const precos = Object.fromEntries(p.results.map(x => [x.brinquedo, x.valor]));
    const compra = Object.fromEntries(c.results.map(x => [x.brinquedo, x.valor]));
    return { brinquedos: BRINQUEDOS.map(b => ({ ...b, preco: precos[b.id] || 0, custo_compra: compra[b.id] || 0 })) };
  },
  "POST brinquedos/preco": async (env, _u, c) => {
    const id = texto(c.brinquedo, 40);
    if (!IDS.has(id)) throw new ErroPainel(400, "Brinquedo desconhecido.");
    await env.DB.prepare("INSERT INTO precos (brinquedo, valor) VALUES (?, ?) ON CONFLICT(brinquedo) DO UPDATE SET valor = excluded.valor")
      .bind(id, centavos(c.valor)).run();
    return { ok: true };
  },
  "GET sessao": async () => ({ ok: true }),
  "POST trocar-senha": async (env, _u, c) => {
    const atual = String(c.atual || ""), nova = String(c.nova || "");
    if (!(await acesso.senhaCorreta(env, atual))) throw new ErroPainel(400, "A senha atual está errada.");
    if (nova.length < 10 || nova.length > 200) throw new ErroPainel(400, "A senha nova precisa ter pelo menos 10 caracteres.");
    await env.DB.prepare("INSERT INTO config (chave, valor) VALUES ('senha_hash', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor")
      .bind(await acesso.gerarHash(nova)).run();
    await acesso.encerrarTodas(env);
    return { ok: true, mensagem: "Senha trocada. Entre de novo com a senha nova." };
  }
};

async function corpoJSON(request) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) throw new ErroPainel(415, "Envie em JSON.");
  const t = await request.text();
  if (t.length > 50000) throw new ErroPainel(413, "Pedido grande demais.");
  try { return JSON.parse(t || "{}"); } catch { throw new ErroPainel(400, "JSON inválido."); }
}

// Bloqueia envio vindo de outro site (CSRF): o Origin tem que ser o próprio site
function mesmaOrigem(request, url) {
  const o = request.headers.get("origin");
  return !o || o === url.origin;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const rota = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
  try {
    await prepararBanco(env);
    if (request.method === "POST" && !mesmaOrigem(request, url)) throw new ErroPainel(403, "Origem não permitida.");

    if (rota === "disponibilidade" && request.method === "GET") {
      return json(await reservas.disponibilidade(env, url), 200, { "cache-control": "public, max-age=60" });
    }

    if (rota === "pedido-orcamento" && request.method === "POST") {
      return json(await orcamentos.pedidoSite(env, request, await corpoJSON(request)));
    }

    if (!rota.startsWith("admin/")) throw new ErroPainel(404, "Rota não encontrada.");
    const sub = rota.slice(6);

    if (sub === "login" && request.method === "POST") {
      const ip = acesso.ipDe(request);
      if (await acesso.bloqueado(env, ip)) throw new ErroPainel(429, "Muitas tentativas erradas. Espere 15 minutos.");
      const { senha } = await corpoJSON(request);
      if (!(await acesso.senhaCorreta(env, String(senha || "").slice(0, 200)))) {
        await acesso.registrarErro(env, ip);
        throw new ErroPainel(401, "Senha errada.");
      }
      await acesso.limparErros(env, ip);
      return json({ ok: true }, 200, { "set-cookie": await acesso.criarSessao(env) });
    }

    if (sub === "sair" && request.method === "POST") {
      return json({ ok: true }, 200, { "set-cookie": await acesso.encerrarSessao(env, request) });
    }

    if (!(await acesso.sessaoValida(env, request))) throw new ErroPainel(401, "Entre com a senha.");

    const fn = ROTAS_PAINEL[`${request.method} ${sub}`];
    if (!fn) throw new ErroPainel(404, "Rota não encontrada.");
    const corpo = request.method === "POST" ? await corpoJSON(request) : null;
    return json(await fn(env, url, corpo));
  } catch (e) {
    if (e instanceof ErroPainel) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: "Erro no servidor. Tente de novo." }, 500);
  }
}
