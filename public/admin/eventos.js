"use strict";
(() => {
  const { api, reais, centavos, valorCampo, dataBR, hoje, esc, aviso, tentar, formulario, campo } = Painel;
  const $ = id => document.getElementById(id);
  const SIT = { planejamento: ["aguardando", "Planejando"], vendas: ["confirmada", "Vendas abertas"], encerrado: ["finalizada", "Encerrado"] };
  const valor = (v, rot) => { const c = centavos(v); if (Number.isNaN(c)) throw new Error(rot + " inválido."); return c; };
  const descPromo = p => p.tipo === "percentual" ? `${p.valor}% de desconto` : p.tipo === "valor" ? `${reais(p.valor)} a menos por ingresso` : `leve ${p.qtd_minima}, pague ${p.qtd_minima - p.valor}`;
  // mesma conta do servidor, só para mostrar antes de confirmar
  const desconto = (p, preco, q) => !p ? 0 : p.tipo === "percentual" ? Math.round(preco * q * p.valor / 100) : p.tipo === "valor" ? Math.min(preco, p.valor) * q : Math.floor(q / p.qtd_minima) * p.valor * preco;
  let eventos = [], abertos = new Set();

  async function carregar() {
    eventos = (await api("eventos/lista")).eventos;
    if (!eventos.length) { $("eventos").innerHTML = `<div class="cartao vazio">Nenhum evento ainda. Crie o primeiro em “+ Novo evento”.</div>`; return; }
    $("eventos").innerHTML = eventos.map(e => {
      const [cor, sit] = SIT[e.status];
      return `<article class="cartao" style="padding:16px 18px;display:grid;gap:10px" data-ev="${e.id}">
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:start">
          <div><h2 style="font-size:1.25rem">${esc(e.nome)}</h2><div class="suave">${dataBR(e.data)}${e.hora_inicio ? " · " + esc(e.hora_inicio) + (e.hora_fim ? "–" + esc(e.hora_fim) : "") : ""}${e.local ? " · " + esc(e.local) : ""}</div></div>
          <span class="selo" data-s="${cor}">${sit}</span>
        </div>
        ${e.descricao ? `<p class="suave" style="font-size:.9rem">${esc(e.descricao)}</p>` : ""}
        <div class="grade-cartoes" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
          <div class="numero cartao" style="box-shadow:none"><span>Ingressos vendidos</span><b>${e.vendidos}${e.capacidade ? " / " + e.capacidade : ""}</b></div>
          <div class="numero cartao verde" style="box-shadow:none"><span>Arrecadado</span><b>${reais(e.receita)}</b></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${e.status === "vendas" ? `<button class="btn primario pequeno" data-a="vender">Vender ingresso</button>` : ""}
          <button class="btn pequeno" data-a="editar">Editar evento</button>
          <button class="btn pequeno" data-a="ingresso">+ Tipo de ingresso</button>
          <button class="btn pequeno" data-a="promocao">+ Promoção</button>
          <button class="btn pequeno perigo" data-a="excluir">Excluir</button>
        </div>
        <details${abertos.has(e.id) ? " open" : ""}><summary style="cursor:pointer;font-weight:800">Ingressos, promoções e vendas</summary>
          <div style="display:grid;gap:14px;margin-top:10px">
          <div class="rolagem"><table class="lista-tab"><thead><tr><th>Ingresso</th><th class="dir">Preço</th><th class="dir">Vendidos</th><th></th></tr></thead><tbody>
            ${e.ingressos.length ? e.ingressos.map(i => `<tr${i.ativo ? "" : ' class="suave"'}><td>${esc(i.nome)}${i.ativo ? "" : " (desativado)"}</td><td class="dir num">${reais(i.preco)}</td><td class="dir num">${i.vendidos}${i.quantidade ? " / " + i.quantidade : ""}</td>
              <td class="dir" style="white-space:nowrap"><button class="btn link" data-a="ingresso" data-id="${i.id}">Editar</button><button class="btn link" data-a="ingresso-x" data-id="${i.id}" aria-label="Apagar ingresso">✕</button></td></tr>`).join("")
              : `<tr><td colspan="4" class="vazio">Cadastre um tipo de ingresso (ex.: 1 hora, dia inteiro).</td></tr>`}
          </tbody></table></div>
          ${e.promocoes.length ? `<div class="rolagem"><table class="lista-tab"><thead><tr><th>Promoção</th><th>Regra</th><th>Validade</th><th class="dir">Usos</th><th></th></tr></thead><tbody>
            ${e.promocoes.map(p => `<tr${p.ativo ? "" : ' class="suave"'}><td>${esc(p.nome)}${p.ativo ? "" : " (desativada)"}</td><td>${descPromo(p)}${p.tipo !== "leve-pague" && p.qtd_minima > 1 ? ` (mín. ${p.qtd_minima})` : ""}</td><td>${p.valido_ate ? "até " + dataBR(p.valido_ate) : "—"}</td><td class="dir num">${p.usos}${p.max_usos ? " / " + p.max_usos : ""}</td>
              <td class="dir" style="white-space:nowrap"><button class="btn link" data-a="promocao" data-id="${p.id}">Editar</button><button class="btn link" data-a="promocao-x" data-id="${p.id}" aria-label="Apagar promoção">✕</button></td></tr>`).join("")}
          </tbody></table></div>` : ""}
          <div class="rolagem"><table class="lista-tab"><thead><tr><th>Data</th><th>Comprador</th><th>Ingresso</th><th class="dir">Total</th><th></th></tr></thead><tbody>
            ${e.vendas.length ? e.vendas.map(v => `<tr><td>${dataBR(v.data)}</td><td>${esc(v.comprador)}${v.contato ? `<br><span class="suave">${esc(v.contato)}</span>` : ""}</td>
              <td>${v.quantidade}x ${esc((e.ingressos.find(i => i.id === v.ingresso_id) || {}).nome || "")}${v.desconto ? `<br><span class="suave">desconto ${reais(v.desconto)}</span>` : ""}</td><td class="dir num">${reais(v.total)}</td>
              <td class="dir"><button class="btn link" data-a="cancelar" data-id="${v.id}" aria-label="Cancelar venda">✕</button></td></tr>`).join("")
              : `<tr><td colspan="5" class="vazio">Nenhuma venda ainda.</td></tr>`}
          </tbody></table></div></div>
        </details></article>`;
    }).join("");
    $("eventos").querySelectorAll("article").forEach(art => {
      const e = eventos.find(x => x.id === Number(art.dataset.ev));
      art.querySelector("details").addEventListener("toggle", ev => ev.target.open ? abertos.add(e.id) : abertos.delete(e.id));
      art.querySelectorAll("[data-a]").forEach(b => b.addEventListener("click", () => acao(b.dataset.a, e, Number(b.dataset.id) || 0)));
    });
  }

  function editarEvento(e) {
    e = e || { nome: "", data: hoje(), hora_inicio: "", hora_fim: "", local: "", capacidade: 0, descricao: "", status: "planejamento" };
    formulario(e.id ? "Editar evento" : "Novo evento", `
      ${campo("Nome do evento", "nome", `maxlength="120" required value="${esc(e.nome)}" placeholder="Ex.: Tarde dos brinquedos na praça"`, true)}
      ${campo("Data", "data", `type="date" required value="${esc(e.data)}"`)}
      ${campo("Começa", "hora_inicio", `type="time" value="${esc(e.hora_inicio)}"`)}
      ${campo("Termina", "hora_fim", `type="time" value="${esc(e.hora_fim)}"`)}
      ${campo("Local", "local", `maxlength="200" value="${esc(e.local)}"`, true)}
      ${campo("Capacidade (0 = sem limite)", "capacidade", `inputmode="numeric" value="${e.capacidade || 0}"`)}
      <div class="campo"><label for="f-status">Situação</label><select id="f-status" name="status">${Object.entries(SIT).map(([k, [, n]]) => `<option value="${k}"${k === e.status ? " selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="campo largo"><label for="f-descricao">Descrição</label><textarea id="f-descricao" name="descricao" maxlength="1000">${esc(e.descricao)}</textarea></div>`,
      async f => { await api("eventos/salvar", { ...f, id: e.id }); aviso(e.id ? "Evento salvo" : "Evento criado"); carregar(); }, { botao: e.id ? "Salvar" : "Criar evento" });
  }

  function editarIngresso(e, i) {
    i = i || { nome: "", preco: 0, quantidade: 0, ativo: 1 };
    formulario(i.id ? "Editar ingresso" : "Novo tipo de ingresso", `
      ${campo("Nome", "nome", `maxlength="80" required value="${esc(i.nome)}" placeholder="Ex.: 1 hora de brinquedo"`, true)}
      ${campo("Preço (R$)", "preco", `inputmode="decimal" value="${valorCampo(i.preco)}"`)}
      ${campo("Quantidade à venda (0 = sem limite)", "quantidade", `inputmode="numeric" value="${i.quantidade}"`)}
      <label class="largo" style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="ativo" ${i.ativo ? "checked" : ""}> À venda</label>`,
      async f => { await api("eventos/ingresso", { ...f, preco: valor(f.preco, "Preço"), id: i.id, evento_id: e.id }); aviso("Ingresso salvo"); abertos.add(e.id); carregar(); });
  }

  function editarPromocao(e, p) {
    p = p || { nome: "", tipo: "percentual", valor: 10, qtd_minima: 1, valido_ate: "", max_usos: 0, ativo: 1 };
    const d = formulario(p.id ? "Editar promoção" : "Nova promoção", `
      ${campo("Nome", "nome", `maxlength="80" required value="${esc(p.nome)}" placeholder="Ex.: Irmãos"`, true)}
      <div class="campo"><label for="f-tipo">Tipo</label><select id="f-tipo" name="tipo">
        <option value="percentual"${p.tipo === "percentual" ? " selected" : ""}>Porcentagem de desconto</option>
        <option value="valor"${p.tipo === "valor" ? " selected" : ""}>Valor a menos por ingresso</option>
        <option value="leve-pague"${p.tipo === "leve-pague" ? " selected" : ""}>Leve X, pague Y</option></select></div>
      ${campo('<span id="rot-valor">Valor</span>', "valor", `inputmode="decimal" value="${p.tipo === "valor" ? valorCampo(p.valor) : p.valor}"`)}
      ${campo('<span id="rot-min">Mínimo de ingressos na compra</span>', "qtd_minima", `inputmode="numeric" value="${p.qtd_minima}"`)}
      ${campo("Válida até (opcional)", "valido_ate", `type="date" value="${esc(p.valido_ate)}"`)}
      ${campo("Limite de usos (0 = sem limite)", "max_usos", `inputmode="numeric" value="${p.max_usos}"`)}
      <label class="largo" style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="ativo" ${p.ativo ? "checked" : ""}> Ativa</label>`,
      async f => {
        if (f.tipo === "valor") f.valor = valor(f.valor, "Desconto");
        await api("eventos/promocao", { ...f, id: p.id, evento_id: e.id }); aviso("Promoção salva"); abertos.add(e.id); carregar();
      });
    const tipo = d.querySelector("#f-tipo");
    const rot = () => {
      d.querySelector("#rot-valor").textContent = { percentual: "Desconto (%)", valor: "Desconto por ingresso (R$)", "leve-pague": "Ingressos grátis" }[tipo.value];
      d.querySelector("#rot-min").textContent = tipo.value === "leve-pague" ? "Leve quantos (ex.: 3)" : "Mínimo de ingressos na compra";
    };
    tipo.addEventListener("change", rot); rot();
  }

  function vender(e) {
    const ing = e.ingressos.filter(i => i.ativo);
    if (!ing.length) return aviso("Cadastre um tipo de ingresso primeiro.", true);
    const promos = e.promocoes.filter(p => p.ativo && (!p.valido_ate || p.valido_ate >= hoje()) && (!p.max_usos || p.usos < p.max_usos));
    const d = formulario(`Vender ingresso · ${esc(e.nome)}`, `
      ${campo("Comprador (pai, mãe ou responsável)", "comprador", 'maxlength="120" required', true)}
      ${campo("Contato (opcional)", "contato", 'maxlength="60" placeholder="WhatsApp"')}
      ${campo("Data da venda", "data", `type="date" value="${hoje()}"`)}
      <div class="campo"><label for="f-ing">Ingresso</label><select id="f-ing" name="ingresso_id">${ing.map(i => `<option value="${i.id}">${esc(i.nome)} · ${reais(i.preco)}</option>`).join("")}</select></div>
      ${campo("Quantidade", "quantidade", 'inputmode="numeric" value="1"')}
      <div class="campo largo"><label for="f-promo">Promoção</label><select id="f-promo" name="promocao_id"><option value="">Nenhuma</option>${promos.map(p => `<option value="${p.id}">${esc(p.nome)} (${descPromo(p)})</option>`).join("")}</select></div>
      <div class="largo resumo-valores num"><div><span>Total</span><b id="f-total">—</b></div></div>`,
      async f => {
        const r = await api("eventos/vender", { ...f, evento_id: e.id, quantidade: Number(f.quantidade) });
        aviso(`Venda de ${reais(r.total)} lançada no financeiro`); abertos.add(e.id); carregar();
      }, { botao: "Confirmar venda" });
    const calc = () => {
      const i = ing.find(x => x.id === Number(d.querySelector("#f-ing").value)), q = Math.max(0, Number(d.querySelector("#f-quantidade").value) || 0);
      const p = promos.find(x => x.id === Number(d.querySelector("#f-promo").value));
      const desc = p && q >= p.qtd_minima ? desconto(p, i.preco, q) : 0;
      d.querySelector("#f-total").textContent = reais(Math.max(0, i.preco * q - desc)) + (desc ? ` (desconto ${reais(desc)})` : "");
    };
    d.addEventListener("input", calc); d.addEventListener("change", calc); calc();
  }

  function acao(a, e, id) {
    if (a === "editar") return editarEvento(e);
    if (a === "vender") return vender(e);
    if (a === "ingresso") return editarIngresso(e, e.ingressos.find(i => i.id === id));
    if (a === "promocao") return editarPromocao(e, e.promocoes.find(p => p.id === id));
    const confirmar = {
      excluir: [`Excluir o evento "${e.nome}"? As vendas saem do financeiro também.`, "eventos/remover", e.id, "Evento excluído"],
      "ingresso-x": ["Apagar este tipo de ingresso?", "eventos/ingresso-remover", id, "Ingresso apagado"],
      "promocao-x": ["Apagar esta promoção?", "eventos/promocao-remover", id, "Promoção apagada"],
      cancelar: ["Cancelar esta venda? O valor sai do financeiro.", "eventos/cancelar-venda", id, "Venda cancelada"]
    }[a];
    if (confirmar && confirm(confirmar[0])) tentar(() => api(confirmar[1], { id: confirmar[2] }), confirmar[3]).then(carregar, () => {});
  }

  $("btn-novo").addEventListener("click", () => editarEvento());
  Painel.montarTopo();
  carregar().catch(err => aviso(err.message, true));
})();
