"use strict";
(() => {
  const { api, reais, centavos, valorCampo, dataBR, hoje, esc, aviso, tentar, janela, formulario, campo } = Painel;
  const $ = id => document.getElementById(id);
  let brinquedos = [], dados = { manutencoes: [], custos: [], compra: {} };
  const nome = id => (brinquedos.find(b => b.id === id) || {}).nome || id;
  const opcoes = sel => brinquedos.map(b => `<option value="${b.id}"${b.id === sel ? " selected" : ""}>${esc(b.nome)}</option>`).join("");
  const gastoDe = (campoK, v) => dados.custos.filter(c => c[campoK] === v).reduce((s, c) => s + c.valor, 0);
  const valor = (v, rot) => { const c = centavos(v); if (Number.isNaN(c)) throw new Error(rot + " inválido."); return c; };

  async function carregar() {
    const dia = $("dia").value || hoje();
    const [c, l] = await Promise.all([api("acervo/consulta?data=" + dia), api("acervo/lista")]);
    dados = l;
    $("consulta").innerHTML = c.brinquedos.map(b => {
      const sit = b.situacao === "livre" ? `<span class="selo" data-s="finalizada">Livre</span>`
        : b.situacao === "reservado" ? `<span class="selo" data-s="confirmada">Reservado</span> <a href="reservas?abrir=${b.reserva.id}&mes=${c.data.slice(0, 7)}">${esc(b.reserva.cliente)}</a>`
        : `<span class="selo" data-s="cancelada">Manutenção</span> <span class="suave">${esc(b.manutencao.defeito)}${b.manutencao.previsao ? " · volta " + dataBR(b.manutencao.previsao) : ""}</span>`;
      return `<tr><td><b>${esc(b.nome)}</b></td><td>${sit}</td><td class="dir num">${reais(gastoDe("brinquedo", b.id))}</td>
        <td class="dir">${b.situacao !== "manutencao" ? `<button class="btn pequeno" data-manut="${b.id}">Manutenção</button>` : ""}</td></tr>`;
    }).join("");
    $("consulta").querySelectorAll("[data-manut]").forEach(x => x.addEventListener("click", () => abrirManut(x.dataset.manut)));

    $("manutencoes").innerHTML = dados.manutencoes.length ? dados.manutencoes.map(m => `<tr>
      <td><b>${esc(nome(m.brinquedo))}</b></td><td>${esc(m.defeito)}${m.reserva_id ? `<br><a class="suave" href="reservas?abrir=${m.reserva_id}">da reserva #${m.reserva_id}</a>` : ""}</td>
      <td>${dataBR(m.inicio)}</td><td>${m.status === "aberta" ? (m.previsao ? `<span${m.previsao < hoje() ? ' style="color:var(--acento);font-weight:700"' : ""}>${dataBR(m.previsao)}</span>` : "—") : dataBR(m.fim)}</td>
      <td><span class="selo" data-s="${m.status === "aberta" ? "cancelada" : "finalizada"}">${m.status === "aberta" ? "Em manutenção" : "Concluída"}</span></td>
      <td class="dir num">${reais(gastoDe("manutencao_id", m.id))}</td>
      <td class="dir" style="white-space:nowrap">${m.status === "aberta" ? `<button class="btn pequeno" data-a="concluir" data-id="${m.id}">Voltou</button> <button class="btn pequeno" data-a="editar" data-id="${m.id}">Editar</button> ` : ""}<button class="btn pequeno" data-a="gasto" data-id="${m.id}">+ Gasto</button> <button class="btn link" data-a="apagar" data-id="${m.id}" aria-label="Apagar">✕</button></td></tr>`).join("")
      : `<tr><td colspan="7" class="vazio">Nenhuma manutenção registrada.</td></tr>`;
    $("manutencoes").querySelectorAll("[data-a]").forEach(x => x.addEventListener("click", () => acaoManut(x.dataset.a, dados.manutencoes.find(m => m.id === Number(x.dataset.id)))));

    $("gastos").innerHTML = dados.custos.length ? dados.custos.map(g => `<tr><td>${dataBR(g.data)}</td><td>${esc(nome(g.brinquedo))}</td><td>${esc(g.descricao) || "—"}</td><td class="dir num">${reais(g.valor)}</td>
      <td class="dir"><button class="btn link" data-g="${g.id}" aria-label="Apagar gasto">✕</button></td></tr>`).join("")
      : `<tr><td colspan="5" class="vazio">Nenhum gasto de manutenção.</td></tr>`;
    $("gastos").querySelectorAll("[data-g]").forEach(x => x.addEventListener("click", () => {
      if (confirm("Apagar este gasto? Ele sai do financeiro também.")) tentar(() => api("manutencao/custo-remover", { id: Number(x.dataset.g) }), "Gasto apagado").then(carregar);
    }));
  }

  function abrirManut(brinquedo) {
    formulario("Colocar em manutenção", `
      <div class="campo largo"><label for="f-b">Brinquedo</label><select id="f-b" name="brinquedo">${opcoes(brinquedo)}</select></div>
      ${campo("Defeito", "defeito", 'maxlength="300" placeholder="Ex.: rasgo na lateral"', true)}
      ${campo("Desde", "inicio", `type="date" value="${hoje()}"`)}
      ${campo("Previsão de volta", "previsao", 'type="date"')}`,
      async f => { await api("manutencao/abrir", f); aviso("Brinquedo em manutenção"); carregar(); });
  }

  function gasto(m) {
    formulario("Gasto de manutenção", `
      <div class="campo largo"><label for="f-b">Brinquedo</label><select id="f-b" name="brinquedo" ${m ? "disabled" : ""}>${opcoes(m && m.brinquedo)}</select></div>
      ${campo("Valor (R$)", "valor", 'inputmode="decimal" required')}
      ${campo("Data", "data", `type="date" value="${hoje()}"`)}
      ${campo("Descrição", "descricao", 'maxlength="150" placeholder="Ex.: cola e remendo"', true)}`,
      async f => {
        await api("manutencao/custo", { ...f, brinquedo: m ? m.brinquedo : f.brinquedo, valor: valor(f.valor, "Valor"), manutencao_id: m ? m.id : 0 });
        aviso("Gasto lançado no financeiro"); carregar();
      }, { botao: "Lançar gasto" });
  }

  function acaoManut(a, m) {
    if (a === "gasto") return gasto(m);
    if (a === "editar") return formulario("Editar manutenção", `${campo("Defeito", "defeito", `maxlength="300" value="${esc(m.defeito)}"`, true)}${campo("Previsão de volta", "previsao", `type="date" value="${esc(m.previsao)}"`)}`,
      async f => { await api("manutencao/editar", { ...f, id: m.id }); aviso("Salvo"); carregar(); });
    if (a === "concluir") return formulario(`${esc(nome(m.brinquedo))} voltou da manutenção`, campo("Data da volta", "fim", `type="date" value="${hoje()}"`),
      async f => { await api("manutencao/concluir", { ...f, id: m.id }); aviso("Brinquedo liberado"); carregar(); }, { botao: "Confirmar volta" });
    if (a === "apagar" && confirm("Apagar esta manutenção e os gastos dela? Os gastos saem do financeiro também."))
      tentar(() => api("manutencao/remover", { id: m.id }), "Manutenção apagada").then(carregar);
  }

  function custosCompra() {
    const d = janela(`<form novalidate>
      <div class="janela-topo"><h2>Preços e custo de compra</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo"><p class="suave" style="font-size:.88rem">O preço de aluguel aparece sozinho nas reservas e orçamentos. O custo de compra (quanto a Maja Kids pagou) serve para calcular o retorno em Relatórios.</p>
        <div class="rolagem"><table class="lista-tab"><thead><tr><th>Brinquedo</th><th class="dir">Aluguel (R$)</th><th class="dir">Custo de compra (R$)</th></tr></thead><tbody>
        ${brinquedos.map(b => `<tr><td>${esc(b.nome)}</td><td class="dir"><input class="in num" style="width:110px" inputmode="decimal" data-p="${b.id}" value="${valorCampo(b.preco)}" aria-label="Aluguel de ${esc(b.nome)}"></td><td class="dir"><input class="in num" style="width:120px" inputmode="decimal" data-b="${b.id}" value="${valorCampo(dados.compra[b.id] || 0)}" aria-label="Custo de compra de ${esc(b.nome)}"></td></tr>`).join("")}
        </tbody></table></div><p class="erro-msg" aria-live="polite"></p></div>
      <div class="janela-rodape"><button class="btn primario">Salvar</button></div></form>`, true);
    d.querySelector("form").addEventListener("submit", async ev => {
      ev.preventDefault();
      try {
        for (const i of d.querySelectorAll("[data-b]")) {
          const v = valor(i.value, "Custo"); if (v !== (dados.compra[i.dataset.b] || 0)) await api("brinquedos/custo-compra", { brinquedo: i.dataset.b, valor: v });
        }
        for (const i of d.querySelectorAll("[data-p]")) {
          const b = brinquedos.find(x => x.id === i.dataset.p), v = valor(i.value, "Preço");
          if (v !== b.preco) { await api("brinquedos/preco", { brinquedo: b.id, valor: v }); b.preco = v; }
        }
        aviso("Valores salvos"); d.close(); carregar();
      } catch (e) { d.querySelector(".erro-msg").textContent = e.message; }
    });
  }

  $("btn-manut").addEventListener("click", () => abrirManut());
  $("btn-gasto").addEventListener("click", () => gasto(null));
  $("btn-custos-compra").addEventListener("click", custosCompra);
  $("dia").addEventListener("change", () => carregar().catch(e => aviso(e.message, true)));
  (async () => {
    Painel.montarTopo(); $("dia").value = hoje();
    brinquedos = (await api("brinquedos")).brinquedos;
    await carregar();
  })().catch(e => aviso(e.message, true));
})();
