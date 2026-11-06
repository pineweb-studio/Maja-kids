"use strict";
(() => {
  const { api, reais, centavos, valorCampo, dataBR, hoje, esc, aviso, tentar, janela, somarDias, telWhats } = Painel;
  const $ = id => document.getElementById(id);
  const SIT = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", rejeitado: "Rejeitado" };
  const COR = { rascunho: "aguardando", enviado: "confirmada", aprovado: "finalizada", rejeitado: "cancelada" };
  const FILTROS = [["todos", "Todos"], ["abertos", "Em aberto"], ["site", "Pedidos do site"], ["aprovados", "Aprovados"], ["rejeitados", "Rejeitados"]];
  let filtro = "todos", brinquedos = [], orcs = [];

  function filtrosHtml() {
    $("filtros").innerHTML = FILTROS.map(([k, n]) => `<button data-f="${k}" aria-pressed="${k === filtro}">${n}</button>`).join("");
    $("filtros").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { filtro = b.dataset.f; filtrosHtml(); carregar(); }));
  }

  async function carregar() {
    orcs = (await tentar(() => api("orcamentos/lista?filtro=" + filtro))).orcamentos;
    $("lista").innerHTML = orcs.length ? orcs.map(o => `<tr class="clicavel" data-id="${o.id}">
      <td>#${o.id}</td><td><b>${esc(o.cliente_nome)}</b>${o.origem === "site" ? ' <span class="selo" data-s="confirmada">site</span>' : ""}<br><span class="suave">${esc(o.telefone)}</span></td>
      <td>${o.evento_data ? dataBR(o.evento_data) : "—"}<br><span class="suave">${esc(o.evento_tipo)}</span></td>
      <td><span class="selo" data-s="${COR[o.status]}">${SIT[o.status]}</span></td>
      <td class="dir">${reais(o.total)}</td>
      <td>${o.validade ? `<span${o.validade < hoje() && ["rascunho", "enviado"].includes(o.status) ? ' style="color:var(--acento);font-weight:700"' : ""}>${dataBR(o.validade)}</span>` : "—"}</td></tr>`).join("")
      : `<tr><td colspan="6" class="vazio">Nenhum orçamento aqui.</td></tr>`;
    $("lista").querySelectorAll("tr[data-id]").forEach(tr => tr.addEventListener("click", () => editor(orcs.find(o => o.id === Number(tr.dataset.id)))));
  }

  function linhaItem(i = {}) {
    const div = document.createElement("div");
    div.className = "linha";
    div.innerHTML = `<input class="in" data-k="descricao" maxlength="150" placeholder="Descrição" value="${esc(i.descricao || "")}" aria-label="Descrição">
      <input class="in num" data-k="quantidade" inputmode="numeric" value="${i.quantidade || 1}" aria-label="Quantidade">
      <input class="in num" data-k="valor" inputmode="decimal" placeholder="R$" value="${valorCampo(i.valor)}" aria-label="Valor unitário">
      <button type="button" class="btn link" aria-label="Tirar item">✕</button>`;
    div.dataset.brinquedo = i.brinquedo || "";
    div.querySelector("button").addEventListener("click", () => { const p = div.parentElement; div.remove(); p.dispatchEvent(new Event("input", { bubbles: true })); });
    return div;
  }

  function editor(o) {
    const novo = !o;
    o = o || { cliente_nome: "", telefone: "", email: "", evento_data: "", evento_tipo: "", endereco: "", taxa_entrega: 0, desconto: 0, validade: somarDias(hoje(), 7), condicoes: "50% de sinal para reservar a data e o restante até o dia da festa. Pix, dinheiro ou cartão.", observacoes: "", status: "rascunho", itens: [] };
    const travado = o.status === "aprovado";
    const d = janela(`<form novalidate>
      <div class="janela-topo"><div><span class="olho">${novo ? "Novo" : "Orçamento #" + o.id}${o.origem === "site" ? " · pedido do site" : ""}</span><h2>${novo ? "Novo orçamento" : esc(o.cliente_nome)}</h2></div><button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        ${!novo ? `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="selo" data-s="${COR[o.status]}">${SIT[o.status]}</span>
          <label class="suave" style="font-weight:700;font-size:.84rem">Mudar situação <select class="in" id="o-sit" style="width:auto;display:inline-block;padding:5px 8px">${Object.entries(SIT).map(([k, n]) => `<option value="${k}"${k === o.status ? " selected" : ""}>${n}</option>`).join("")}</select></label></div>
          ${travado ? `<div class="aviso ok">Aprovado: o valor entrou no financeiro. Para editar, mude a situação primeiro.</div>` : ""}` : ""}
        <fieldset ${travado ? "disabled" : ""} style="border:0;padding:0;margin:0;display:grid;gap:16px">
        <div class="grade-campos">
          <div class="campo largo"><label for="o-nome">Cliente</label><input id="o-nome" name="cliente_nome" maxlength="120" required value="${esc(o.cliente_nome)}"></div>
          <div class="campo"><label for="o-tel">Telefone (WhatsApp)</label><input id="o-tel" name="telefone" type="tel" maxlength="20" value="${esc(o.telefone)}"></div>
          <div class="campo"><label for="o-email">E-mail</label><input id="o-email" name="email" type="email" maxlength="120" value="${esc(o.email)}"></div>
          <div class="campo"><label for="o-data">Data do evento</label><input id="o-data" name="evento_data" type="date" value="${esc(o.evento_data)}"></div>
          <div class="campo"><label for="o-tipo">Tipo de evento</label><input id="o-tipo" name="evento_tipo" maxlength="60" placeholder="Ex.: aniversário de 5 anos" value="${esc(o.evento_tipo)}"></div>
          <div class="campo largo"><label for="o-end">Endereço da festa</label><input id="o-end" name="endereco" maxlength="200" value="${esc(o.endereco)}"></div>
        </div>
        <div class="secao"><h3>Itens</h3>
          <div class="itens-edit" id="o-itens"></div>
          <div class="adicionar" style="grid-template-columns:1fr auto">
            <select class="in" id="o-addb" aria-label="Adicionar brinquedo"><option value="">Adicionar brinquedo…</option>${brinquedos.map(b => `<option value="${b.id}">${esc(b.nome)}${b.preco ? " · " + reais(b.preco) : ""}</option>`).join("")}</select>
            <button type="button" class="btn" id="o-addl">+ Outro item</button>
          </div>
        </div>
        <div class="grade-campos">
          <div class="campo"><label for="o-taxa">Entrega e montagem (R$)</label><input id="o-taxa" name="taxa_entrega" inputmode="decimal" value="${valorCampo(o.taxa_entrega)}"></div>
          <div class="campo"><label for="o-desc">Desconto (R$)</label><input id="o-desc" name="desconto" inputmode="decimal" value="${valorCampo(o.desconto)}"></div>
          <div class="campo"><label for="o-val">Válido até</label><input id="o-val" name="validade" type="date" value="${esc(o.validade)}"></div>
          <div class="campo largo"><label for="o-cond">Condições de pagamento</label><textarea id="o-cond" name="condicoes" maxlength="500">${esc(o.condicoes)}</textarea></div>
          <div class="campo largo"><label for="o-obs">Observações</label><textarea id="o-obs" name="observacoes" maxlength="1000">${esc(o.observacoes)}</textarea></div>
        </div>
        </fieldset>
        <div class="resumo-valores num"><div><span>Total</span><b id="o-total">—</b></div></div>
        <p class="erro-msg" aria-live="polite"></p>
      </div>
      <div class="janela-rodape">
        ${!novo ? `<button type="button" class="btn perigo" id="o-excluir">Excluir</button>
          <a class="btn" href="orcamento-pdf?id=${o.id}" target="_blank" rel="noopener">PDF / imprimir</a>
          ${o.telefone ? `<a class="btn whats" id="o-whats" target="_blank" rel="noopener">Mandar no WhatsApp</a>` : ""}` : ""}
        ${!travado ? `<button class="btn primario">${novo ? "Criar orçamento" : "Salvar"}</button>` : ""}
      </div></form>`, true);

    const caixa = d.querySelector("#o-itens");
    (o.itens.length ? o.itens : []).forEach(i => caixa.appendChild(linhaItem(i)));
    const ler = () => [...caixa.children].map(l => ({ brinquedo: l.dataset.brinquedo, descricao: l.querySelector('[data-k="descricao"]').value, quantidade: Number(l.querySelector('[data-k="quantidade"]').value) || 1, valor: centavos(l.querySelector('[data-k="valor"]').value) }));
    const recalc = () => {
      const itens = ler();
      const t = Math.max(0, itens.reduce((s, i) => s + (i.valor || 0) * i.quantidade, 0) + (centavos(d.querySelector("#o-taxa").value) || 0) - (centavos(d.querySelector("#o-desc").value) || 0));
      d.querySelector("#o-total").textContent = reais(t);
    };
    d.addEventListener("input", recalc); recalc();
    d.querySelector("#o-addb").addEventListener("change", ev => {
      const b = brinquedos.find(x => x.id === ev.target.value); if (!b) return;
      caixa.appendChild(linhaItem({ brinquedo: b.id, descricao: b.nome, quantidade: 1, valor: b.preco })); ev.target.value = ""; recalc();
    });
    d.querySelector("#o-addl").addEventListener("click", () => { caixa.appendChild(linhaItem()); caixa.lastChild.querySelector("input").focus(); });

    d.querySelector("#o-sit")?.addEventListener("change", ev => tentar(() => api("orcamentos/status", { id: o.id, status: ev.target.value }), ev.target.value === "aprovado" ? "Aprovado e lançado no financeiro" : "Situação mudada")
      .then(async () => { d.close(); await carregar(); editor(orcs.find(x => x.id === o.id) || (await api("orcamentos/um?id=" + o.id)).orcamento); }, () => {}));
    d.querySelector("#o-excluir")?.addEventListener("click", () => { if (confirm("Excluir este orçamento?")) tentar(() => api("orcamentos/remover", { id: o.id }), "Orçamento excluído").then(() => { d.close(); carregar(); }); });
    const w = d.querySelector("#o-whats");
    if (w) {
      const linhas = o.itens.map(i => `- ${i.quantidade > 1 ? i.quantidade + "x " : ""}${i.descricao}: ${reais(i.valor * i.quantidade)}`).join("\n");
      const msg = `Olá, ${o.cliente_nome.split(" ")[0]}! Segue o orçamento da Maja Kids${o.evento_data ? " para " + dataBR(o.evento_data) : ""}:\n${linhas}${o.taxa_entrega ? `\n- Entrega e montagem: ${reais(o.taxa_entrega)}` : ""}${o.desconto ? `\n- Desconto: -${reais(o.desconto)}` : ""}\nTotal: ${reais(o.total)}\n${o.condicoes ? o.condicoes + "\n" : ""}Válido até ${dataBR(o.validade)}. Posso reservar?`;
      w.href = `https://wa.me/${telWhats(o.telefone)}?text=${encodeURIComponent(msg)}`;
    }

    d.querySelector("form").addEventListener("submit", async ev => {
      ev.preventDefault();
      const erro = d.querySelector(".erro-msg");
      const dados = Object.fromEntries([...d.querySelectorAll("[name]")].map(i => [i.name, i.value]));
      dados.taxa_entrega = centavos(dados.taxa_entrega); dados.desconto = centavos(dados.desconto);
      dados.itens = ler();
      if ([dados.taxa_entrega, dados.desconto, ...dados.itens.map(i => i.valor)].some(Number.isNaN)) { erro.textContent = "Tem valor inválido."; return; }
      if (!novo) dados.id = o.id;
      try {
        const r = await api("orcamentos/salvar", dados);
        aviso(novo ? "Orçamento criado" : "Orçamento salvo"); d.close(); await carregar();
        editor(orcs.find(x => x.id === r.id) || (await api("orcamentos/um?id=" + r.id)).orcamento);
      } catch (e) { erro.textContent = e.message; }
    });
  }

  $("btn-novo").addEventListener("click", () => editor(null));
  (async () => {
    Painel.montarTopo(); filtrosHtml();
    brinquedos = (await api("brinquedos")).brinquedos;
    await carregar();
    const abrir = Number(Painel.param("abrir"));
    if (abrir) { const o = orcs.find(x => x.id === abrir) || (await api("orcamentos/um?id=" + abrir).catch(() => ({}))).orcamento; if (o) editor(o); history.replaceState(null, "", "orcamentos"); }
  })().catch(() => {});
})();
