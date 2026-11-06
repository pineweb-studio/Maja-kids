"use strict";
(() => {
  const { api, reais, centavos, valorCampo, dataBR, hoje, esc, aviso, tentar } = Painel;
  const $ = id => document.getElementById(id);

  const SIT = {
    aguardando: { nome: "Aguardando sinal", prox: "confirmada", acao: "Marcar como confirmada" },
    confirmada: { nome: "Confirmada", prox: "entregue", acao: "Marcar como entregue" },
    entregue: { nome: "Entregue", prox: "recolhida", acao: "Marcar como recolhida" },
    recolhida: { nome: "Recolhida", prox: null, acao: null },
    finalizada: { nome: "Finalizada" },
    cancelada: { nome: "Cancelada" }
  };
  const ABERTAS = ["aguardando", "confirmada", "entregue", "recolhida"];
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  let brinquedos = [];
  let reservas = [];
  let mes = /^\d{4}-\d{2}$/.test(Painel.param("mes") || "") ? Painel.param("mes") : hoje().slice(0, 7);
  let modo = "cal";
  try { modo = localStorage.getItem("maja-modo-reservas") === "quadro" ? "quadro" : "cal"; } catch {}

  const nomeBrinquedo = id => (brinquedos.find(b => b.id === id) || {}).nome || id;
  const falta = r => Math.max(0, r.total - r.pago);
  const semSinal = r => r.status === "confirmada" && r.pago < Math.ceil(r.total / 2);

  /* ===== Carregar ===== */
  async function carregar() {
    const d = await tentar(() => api("reservas/lista?mes=" + mes));
    reservas = d.reservas;
    desenhar();
  }

  function desenhar() {
    $("mes").value = mes;
    $("modo-cal").setAttribute("aria-pressed", modo === "cal");
    $("modo-quadro").setAttribute("aria-pressed", modo === "quadro");
    $("vista-cal").hidden = modo !== "cal";
    $("vista-quadro").hidden = modo !== "quadro";
    modo === "cal" ? desenharCalendario() : desenharQuadro();
  }

  function desenharCalendario() {
    const [a, m] = mes.split("-").map(Number);
    const primeiro = new Date(a, m - 1, 1);
    const inicio = new Date(a, m - 1, 1 - primeiro.getDay());
    const hj = hoje();
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      if (i >= 35 && d.getMonth() !== m - 1) break;
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const doDia = reservas.filter(r => r.data === iso);
      const cel = document.createElement("div");
      cel.className = "dia" + (d.getMonth() !== m - 1 ? " fora" : "") + (iso === hj ? " hoje" : "");
      cel.tabIndex = 0;
      cel.setAttribute("role", "button");
      cel.setAttribute("aria-label", `${dataBR(iso)}: ${doDia.length ? doDia.length + " reserva(s)" : "nova reserva"}`);
      cel.innerHTML = `<span class="n">${d.getDate()}</span>` +
        doDia.slice(0, 3).map(r => `<button class="chip ${r.status}" data-s="${r.status}" data-id="${r.id}">${esc(r.hora_inicio)} ${esc(r.cliente_nome.split(" ")[0])}</button>`).join("") +
        (doDia.length > 3 ? `<span class="mais">+${doDia.length - 3}</span>` : "") +
        `<span class="pontos">${doDia.map(r => `<i data-s="${r.status}"></i>`).join("")}</span>`;
      cel.querySelectorAll(".chip").forEach(c => c.addEventListener("click", ev => { ev.stopPropagation(); abrirDetalhe(Number(c.dataset.id)); }));
      const abrirDia = () => doDia.length === 1 ? abrirDetalhe(doDia[0].id) : formulario(null, iso);
      cel.addEventListener("click", () => { if (window.matchMedia("(max-width: 720px)").matches && doDia.length) document.getElementById("r-" + doDia[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" }); else abrirDia(); });
      cel.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrirDia(); } });
      dias.push(cel);
    }
    $("dias").replaceChildren(...dias);

    const doMes = reservas.filter(r => r.data.startsWith(mes));
    const lista = $("lista-mes");
    lista.innerHTML = `<h2>${MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1)} de ${a} · ${doMes.length} reserva${doMes.length === 1 ? "" : "s"}</h2>`;
    if (!doMes.length) { lista.insertAdjacentHTML("beforeend", `<div class="cartao vazio">Nenhuma reserva neste mês. Toque num dia do calendário ou em "Nova reserva".</div>`); return; }
    for (const r of doMes) {
      const bt = document.createElement("button");
      bt.className = "cartao linha-reserva"; bt.id = "r-" + r.id;
      const dia = new Date(r.data + "T12:00:00");
      bt.innerHTML = `<div class="data"><b>${r.data.slice(8)}</b><small>${dia.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small></div>
        <div class="quem"><b>${esc(r.cliente_nome)}</b><span class="selo" data-s="${r.status}">${SIT[r.status].nome}</span> <span>${esc(r.hora_inicio)}${r.hora_fim ? "–" + esc(r.hora_fim) : ""} · ${r.itens.length} brinquedo${r.itens.length === 1 ? "" : "s"}</span></div>
        <div class="valores num"><b>${reais(r.total)}</b>${r.status === "cancelada" ? "" : falta(r) ? `<span style="color:var(--acento)">falta ${reais(falta(r))}</span>` : `<span style="color:var(--verde)">pago</span>`}</div>`;
      bt.addEventListener("click", () => abrirDetalhe(r.id));
      lista.appendChild(bt);
    }
  }

  function desenharQuadro() {
    const colunas = [...ABERTAS, "finalizada", "cancelada"].map(s => {
      const daqui = reservas.filter(r => r.status === s && (ABERTAS.includes(s) || r.data.startsWith(mes)));
      const col = document.createElement("div");
      col.className = "coluna";
      col.innerHTML = `<h2><span class="selo" data-s="${s}">${SIT[s].nome}</span><span class="qtd">${daqui.length}</span></h2>`;
      for (const r of daqui) {
        const f = document.createElement("button");
        f.className = "cartao ficha"; f.dataset.s = r.status;
        let alerta = "";
        if (semSinal(r)) alerta = "Sem o sinal de 50%";
        else if (r.status === "aguardando") alerta = "Data só garantida com o sinal";
        else if (["confirmada", "aguardando"].includes(r.status) && r.data < hoje()) alerta = "Festa já passou";
        else if (r.status === "entregue" && r.data < hoje()) alerta = "Falta recolher";
        f.innerHTML = `<b>${esc(r.cliente_nome)}</b>
          <div class="info"><span>${dataBR(r.data)} ${esc(r.hora_inicio)}</span><span class="num">${reais(r.total)}</span></div>
          <div class="info"><span>${r.itens.map(i => esc(nomeBrinquedo(i.brinquedo))).join(", ") || "Sem brinquedos"}</span></div>
          ${alerta ? `<span class="alerta">${alerta}</span>` : ""}`;
        f.addEventListener("click", () => abrirDetalhe(r.id));
        col.appendChild(f);
      }
      if (!daqui.length) col.insertAdjacentHTML("beforeend", `<p class="suave" style="font-size:.84rem;padding:4px">Nada aqui.</p>`);
      return col;
    });
    $("quadro").replaceChildren(...colunas);
  }

  /* ===== Janela genérica ===== */
  function janela(html, largo) {
    const d = document.createElement("dialog");
    if (largo) d.style.width = "min(820px, calc(100vw - 24px))";
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener("close", () => d.remove());
    d.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", () => d.close()));
    d.showModal();
    return d;
  }

  /* ===== Detalhe da reserva ===== */
  async function abrirDetalhe(id, jaAberta) {
    const r = reservas.find(x => x.id === id);
    if (!r) return;
    const aberta = ABERTAS.includes(r.status);
    const avisos = [];
    if (r.status === "aguardando") avisos.push(["", "A data só fica garantida quando o sinal for pago."]);
    if (semSinal(r)) avisos.push(["urgente", `Confirmada sem o sinal de 50% (${reais(Math.ceil(r.total / 2))}).`]);
    if (aberta && r.data < hoje() && ["aguardando", "confirmada"].includes(r.status)) avisos.push(["urgente", "A festa já passou e a reserva ainda não foi marcada como entregue."]);
    if (r.status === "entregue" && r.data < hoje()) avisos.push(["", "Brinquedos ainda com o cliente: falta recolher."]);
    if (r.itens.some(i => i.status === "defeito")) avisos.push(["urgente", "Tem brinquedo que voltou com defeito."]);
    if (r.status === "cancelada") avisos.push(["", `Cancelada: ${esc(r.motivo_cancelamento)}. Retido: ${reais(r.valor_retido)}.`]);
    if (r.status === "finalizada") avisos.push(["ok", "Reserva finalizada, tudo pago e devolvido."]);

    const html = `
      <div class="janela-topo"><div><span class="olho">Reserva #${r.id}</span><h2>${esc(r.cliente_nome)}</h2></div><button class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">
          <span class="selo" data-s="${r.status}">${SIT[r.status].nome}</span>
          ${aberta ? `<label class="suave" style="font-size:.84rem;font-weight:700">Mudar situação <select class="in" id="d-sit" style="width:auto;display:inline-block;padding:5px 8px">${ABERTAS.map(s => `<option value="${s}"${s === r.status ? " selected" : ""}>${SIT[s].nome}</option>`).join("")}</select></label>` : ""}
        </div>
        ${avisos.map(([c, t]) => `<div class="aviso ${c}">${t}</div>`).join("")}
        <div class="resumo-valores num">
          <div><span>Total</span><b>${reais(r.total)}</b></div>
          <div><span>Pago</span><b>${reais(r.pago)}</b></div>
          <div class="${falta(r) && r.status !== "cancelada" ? "falta" : ""}"><span>Falta</span><b>${reais(r.status === "cancelada" ? 0 : falta(r))}</b></div>
          <div><span>Sinal (50%)</span><b>${reais(Math.ceil(r.total / 2))}</b></div>
        </div>
        <dl class="dados">
          <div><dt>Data</dt><dd>${dataBR(r.data)} · ${esc(r.hora_inicio)}${r.hora_fim ? " às " + esc(r.hora_fim) : ""}</dd></div>
          <div><dt>Tipo de evento</dt><dd>${r.tipo_evento === "fechado" ? "Fechado (5 horas)" : "Aberto (4 horas)"}</dd></div>
          <div><dt>Telefone</dt><dd>${esc(r.telefone) || "—"}</dd></div>
          <div><dt>CPF ou CNPJ</dt><dd>${esc(r.documento) || "—"}</dd></div>
          <div><dt>E-mail</dt><dd>${esc(r.email) || "—"}</dd></div>
          <div><dt>Taxa de entrega e montagem</dt><dd class="num">${reais(r.taxa_entrega)}</dd></div>
          <div style="grid-column:1/-1"><dt>Endereço da montagem</dt><dd>${esc(r.endereco_montagem) || "—"}</dd></div>
          <div style="grid-column:1/-1"><dt>Endereço residencial</dt><dd>${esc(r.endereco_residencial) || "—"}</dd></div>
          ${r.observacoes ? `<div style="grid-column:1/-1"><dt>Observações</dt><dd>${esc(r.observacoes).replace(/\n/g, "<br>")}</dd></div>` : ""}
        </dl>
        <div class="secao">
          <h3>Brinquedos</h3>
          <table class="tabela"><tbody>
            ${r.itens.map(i => `<tr><td>${esc(nomeBrinquedo(i.brinquedo))}${i.valor === 0 ? ' <span class="suave">(brinde)</span>' : ""}</td>
              <td class="num">${reais(i.valor)}</td>
              <td>${aberta ? `<select data-baixa="${i.id}" aria-label="Situação do brinquedo">${["locado", "devolvido", "defeito"].map(s => `<option value="${s}"${s === i.status ? " selected" : ""}>${{ locado: "Locado", devolvido: "Devolvido", defeito: "Com defeito" }[s]}</option>`).join("")}</select>
                <button class="btn link" data-tirar="${i.id}" aria-label="Remover">✕</button>` : `<span class="suave">${i.status}</span>`}</td></tr>`).join("") || `<tr><td class="suave">Nenhum brinquedo ainda.</td></tr>`}
          </tbody></table>
          ${aberta ? `<div class="adicionar">
            <select class="in" id="d-brinq" aria-label="Brinquedo"><option value="">Adicionar brinquedo…</option>${brinquedos.filter(b => !r.itens.some(i => i.brinquedo === b.id)).map(b => `<option value="${b.id}">${esc(b.nome)}</option>`).join("")}</select>
            <input class="in num" id="d-valor" inputmode="decimal" placeholder="Valor R$" aria-label="Valor (0 = brinde)">
            <button class="btn" id="d-add">Adicionar</button>
          </div>` : ""}
        </div>
        <div class="secao">
          <h3>Pagamentos</h3>
          <table class="tabela"><tbody>
            ${r.pagamentos.map(p => `<tr><td>${dataBR(p.data)}</td><td>${esc(p.forma) || ""}</td><td class="num">${reais(p.valor)} ${aberta ? `<button class="btn link" data-tirarpag="${p.id}" aria-label="Remover pagamento">✕</button>` : ""}</td></tr>`).join("") || `<tr><td class="suave">Nenhum pagamento ainda.</td></tr>`}
          </tbody></table>
          ${aberta ? `<div class="adicionar pag">
            <input class="in num" id="p-valor" inputmode="decimal" placeholder="Valor R$" aria-label="Valor do pagamento" value="${valorCampo(r.pago === 0 && r.total ? Math.ceil(r.total / 2) : falta(r))}">
            <input class="in" id="p-data" type="date" value="${hoje()}" aria-label="Data do pagamento">
            <select class="in" id="p-forma" aria-label="Forma"><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option></select>
            <button class="btn" id="p-add">Registrar</button>
          </div>` : ""}
        </div>
      </div>
      <div class="janela-rodape">
        ${r.status !== "finalizada" ? `<button class="btn perigo" id="d-excluir">Excluir</button>` : ""}
        ${aberta ? `<button class="btn perigo" id="d-cancelar">Cancelar reserva</button>` : ""}
        ${r.status !== "cancelada" ? `<a class="btn" href="contrato?id=${r.id}" target="_blank" rel="noopener">Contrato</a>` : ""}
        ${aberta ? `<button class="btn" id="d-editar">Editar</button>` : ""}
        ${aberta && falta(r) && r.telefone ? `<a class="btn whats" id="d-cobrar" target="_blank" rel="noopener">Cobrar no WhatsApp</a>` : ""}
        ${aberta && SIT[r.status].prox ? `<button class="btn primario" id="d-prox">${SIT[r.status].acao}</button>` : ""}
        ${r.status === "recolhida" ? `<button class="btn primario" id="d-finalizar">Baixa total e finalizar</button>` : ""}
      </div>`;
    const d = jaAberta || janela(html, true);
    if (jaAberta) { d.innerHTML = html; d.querySelectorAll("[data-fechar]").forEach(b => b.addEventListener("click", () => d.close())); }

    const recarregar = async () => { await carregar(); if (d.open) abrirDetalhe(id, d); };
    const on = (sel, fn) => { const el = d.querySelector(sel); if (el) el.addEventListener("click", fn); };

    d.querySelector("#d-sit")?.addEventListener("change", ev => tentar(() => api("reservas/status", { id, status: ev.target.value }), "Situação mudada").then(recarregar, recarregar));
    on("#d-prox", () => tentar(() => api("reservas/status", { id, status: SIT[r.status].prox }), "Situação mudada").then(recarregar));
    on("#d-finalizar", () => { if (confirm("Marcar todos os brinquedos como devolvidos e finalizar?")) tentar(() => api("reservas/finalizar", { id }), "Reserva finalizada").then(recarregar); });
    d.querySelector("#d-brinq")?.addEventListener("change", ev => {
      const b = brinquedos.find(x => x.id === ev.target.value);
      d.querySelector("#d-valor").value = b && b.preco ? valorCampo(b.preco) : "";
    });
    on("#d-add", () => {
      const brinquedo = d.querySelector("#d-brinq").value;
      const valor = centavos(d.querySelector("#d-valor").value);
      if (!brinquedo) return aviso("Escolha o brinquedo.", true);
      if (Number.isNaN(valor)) return aviso("Valor inválido.", true);
      tentar(() => api("reservas/item", { reserva_id: id, brinquedo, valor }), "Brinquedo adicionado").then(recarregar);
    });
    d.querySelectorAll("[data-baixa]").forEach(s => s.addEventListener("change", async () => {
      try {
        await tentar(() => api("reservas/item-baixa", { id: Number(s.dataset.baixa), status: s.value }), "Baixa registrada");
        if (s.value === "defeito") {
          const item = r.itens.find(i => i.id === Number(s.dataset.baixa));
          const defeito = prompt(`Qual o defeito do ${nomeBrinquedo(item.brinquedo)}? (deixe vazio para não abrir manutenção agora)`);
          if (defeito && defeito.trim()) await tentar(() => api("manutencao/abrir", { brinquedo: item.brinquedo, defeito, reserva_id: id }), "Manutenção aberta no Acervo");
        }
      } catch {}
      recarregar();
    }));
    d.querySelectorAll("[data-tirar]").forEach(b => b.addEventListener("click", () => { if (confirm("Tirar este brinquedo da reserva?")) tentar(() => api("reservas/item-remover", { id: Number(b.dataset.tirar) }), "Brinquedo removido").then(recarregar); }));
    on("#p-add", () => {
      const valor = centavos(d.querySelector("#p-valor").value);
      if (!valor) return aviso("Escreva o valor do pagamento.", true);
      tentar(() => api("reservas/pagamento", { reserva_id: id, valor, data: d.querySelector("#p-data").value, forma: d.querySelector("#p-forma").value }), "Pagamento registrado").then(recarregar);
    });
    d.querySelectorAll("[data-tirarpag]").forEach(b => b.addEventListener("click", () => { if (confirm("Apagar este pagamento? Ele sai do financeiro também.")) tentar(() => api("reservas/pagamento-remover", { id: Number(b.dataset.tirarpag) }), "Pagamento apagado").then(recarregar); }));
    on("#d-editar", () => { d.close(); formulario(r); });
    on("#d-cancelar", () => cancelar(r, d));
    on("#d-excluir", () => {
      if (!confirm(`Excluir a reserva de ${r.cliente_nome}? Os pagamentos saem do financeiro. Isso não tem volta.`)) return;
      tentar(() => api("reservas/remover", { id }), "Reserva excluída").then(() => { d.close(); carregar(); });
    });
    const cobrar = d.querySelector("#d-cobrar");
    if (cobrar) {
      let tel = r.telefone.replace(/\D/g, "");
      if (tel.length <= 11) tel = "55" + tel;
      const msg = `Olá, ${r.cliente_nome.split(" ")[0]}! Aqui é da Maja Kids. Sobre a sua festa do dia ${dataBR(r.data)}, ${r.pago < Math.ceil(r.total / 2) && r.status !== "entregue" && r.status !== "recolhida" ? `o sinal para garantir a data é de ${reais(Math.ceil(r.total / 2) - r.pago)}` : `falta pagar ${reais(falta(r))}`}. Pode me mandar o comprovante quando fizer? Obrigada!`;
      cobrar.href = `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
    }
  }

  function cancelar(r, detalhe) {
    const d = janela(`<form>
      <div class="janela-topo"><h2>Cancelar reserva #${r.id}</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <p>Já foi pago <b class="num">${reais(r.pago)}</b>. O que não ficar retido entra no financeiro como devolução.</p>
        <div class="campo"><label for="c-motivo">Motivo</label><input id="c-motivo" required maxlength="300"></div>
        <div class="campo"><label for="c-retido">Valor retido (R$)</label><input id="c-retido" inputmode="decimal" value="${valorCampo(r.pago)}"></div>
      </div>
      <div class="janela-rodape"><button class="btn primario">Cancelar reserva</button></div></form>`);
    d.querySelector("form").addEventListener("submit", ev => {
      ev.preventDefault();
      const valor_retido = centavos(d.querySelector("#c-retido").value);
      if (Number.isNaN(valor_retido)) return aviso("Valor retido inválido.", true);
      tentar(() => api("reservas/cancelar", { id: r.id, motivo: d.querySelector("#c-motivo").value, valor_retido }), "Reserva cancelada")
        .then(async () => { d.close(); detalhe.close(); await carregar(); });
    });
  }

  /* ===== Nova reserva / editar ===== */
  async function formulario(r, dataInicial) {
    const nova = !r;
    r = r || { cliente_nome: "", documento: "", telefone: "", email: "", endereco_residencial: "", endereco_montagem: "", tipo_evento: "aberto", data: dataInicial || "", hora_inicio: "", hora_fim: "", taxa_entrega: 0, observacoes: "" };
    const d = janela(`<form novalidate>
      <div class="janela-topo"><h2>${nova ? "Nova reserva" : "Editar reserva #" + r.id}</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="grade-campos">
          <div class="campo largo"><label for="f-nome">Nome completo do cliente</label><input id="f-nome" name="cliente_nome" required maxlength="120" autocomplete="off" value="${esc(r.cliente_nome)}"></div>
          <div class="campo"><label for="f-doc">CPF ou CNPJ</label><input id="f-doc" name="documento" inputmode="numeric" maxlength="20" value="${esc(r.documento)}"></div>
          <div class="campo"><label for="f-tel">Telefone (WhatsApp)</label><input id="f-tel" name="telefone" type="tel" maxlength="20" placeholder="(33) 99999-9999" value="${esc(r.telefone)}"></div>
          <div class="campo largo"><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" maxlength="120" value="${esc(r.email)}"></div>
          <div class="campo largo"><label for="f-mont">Endereço exato da montagem</label><input id="f-mont" name="endereco_montagem" maxlength="200" value="${esc(r.endereco_montagem)}"></div>
          <div class="campo largo"><label for="f-res">Endereço residencial</label><input id="f-res" name="endereco_residencial" maxlength="200" value="${esc(r.endereco_residencial)}"></div>
          <div class="campo"><label for="f-tipo">Tipo de evento</label><select id="f-tipo" name="tipo_evento"><option value="aberto"${r.tipo_evento === "aberto" ? " selected" : ""}>Aberto (4 horas)</option><option value="fechado"${r.tipo_evento === "fechado" ? " selected" : ""}>Fechado (5 horas)</option></select></div>
          <div class="campo"><label for="f-data">Data</label><input id="f-data" name="data" type="date" required value="${esc(r.data)}"></div>
          <div class="campo"><label for="f-ini">Início</label><input id="f-ini" name="hora_inicio" type="time" value="${esc(r.hora_inicio)}"></div>
          <div class="campo"><label for="f-fim">Término</label><input id="f-fim" name="hora_fim" type="time" value="${esc(r.hora_fim)}"></div>
          <div class="campo"><label for="f-taxa">Taxa de entrega e montagem (R$)</label><input id="f-taxa" name="taxa_entrega" inputmode="decimal" value="${valorCampo(r.taxa_entrega)}"></div>
          <div class="campo largo"><label for="f-obs">Observações</label><textarea id="f-obs" name="observacoes" maxlength="1000">${esc(r.observacoes)}</textarea></div>
        </div>
        ${nova ? `<div class="secao"><h3>Brinquedos</h3><p class="suave" style="font-size:.84rem;margin-bottom:8px">Marque os brinquedos. O valor vem da tabela de preços; mude se precisar (0 = brinde).</p><div class="escolha-brinquedos" id="f-brinq"></div></div>` : ""}
        <p class="erro-msg" aria-live="polite"></p>
      </div>
      <div class="janela-rodape"><button class="btn primario">${nova ? "Criar reserva" : "Salvar"}</button></div></form>`, true);

    const caixa = d.querySelector("#f-brinq");
    async function marcarOcupados() {
      if (!caixa) return;
      const data = d.querySelector("#f-data").value;
      let ocupados = [];
      if (data) {
        // usa a mesma rota pública do site
        const resp = await fetch("/api/disponibilidade?data=" + data, { cache: "no-store" }).then(x => x.json()).catch(() => ({}));
        ocupados = resp.ocupados || [];
      }
      caixa.querySelectorAll("label").forEach(l => {
        const oc = ocupados.includes(l.dataset.id);
        l.classList.toggle("ocupado", oc);
        l.querySelector("small").textContent = oc ? "Já reservado nessa data" : "";
        if (oc) l.querySelector("input[type=checkbox]").checked = false;
        l.querySelector("input[type=checkbox]").disabled = oc;
      });
    }
    if (caixa) {
      caixa.innerHTML = brinquedos.map(b => `<label data-id="${b.id}"><input type="checkbox" value="${b.id}"><span>${esc(b.nome)}<small></small></span><input class="in num" inputmode="decimal" placeholder="R$" aria-label="Valor de ${esc(b.nome)}" value="${valorCampo(b.preco)}"></label>`).join("");
      d.querySelector("#f-data").addEventListener("change", marcarOcupados);
      marcarOcupados();
    }

    d.querySelector("form").addEventListener("submit", async ev => {
      ev.preventDefault();
      const f = ev.target, erro = d.querySelector(".erro-msg");
      const dados = Object.fromEntries([...f.querySelectorAll("[name]")].map(i => [i.name, i.value]));
      dados.taxa_entrega = centavos(dados.taxa_entrega);
      if (Number.isNaN(dados.taxa_entrega)) { erro.textContent = "Taxa de entrega inválida."; return; }
      if (!dados.data) { erro.textContent = "Escolha a data da festa."; return; }
      if (!nova) dados.id = r.id;
      if (caixa) {
        dados.itens = [...caixa.querySelectorAll("label")].filter(l => l.querySelector("input[type=checkbox]").checked)
          .map(l => ({ brinquedo: l.dataset.id, valor: centavos(l.querySelector("input.in").value) }));
        if (dados.itens.some(i => Number.isNaN(i.valor))) { erro.textContent = "Tem valor de brinquedo inválido."; return; }
      }
      const bt = f.querySelector(".janela-rodape .btn"); bt.disabled = true;
      try {
        const res = await api("reservas/salvar", dados);
        aviso(nova ? "Reserva criada" : "Reserva salva");
        d.close();
        if (dados.data.slice(0, 7) !== mes) mes = dados.data.slice(0, 7);
        await carregar();
        abrirDetalhe(res.id);
      } catch (e) { erro.textContent = e.message; bt.disabled = false; }
    });
  }

  /* ===== Tabela de preços ===== */
  function precos() {
    const d = janela(`<form>
      <div class="janela-topo"><h2>Preços dos brinquedos</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo"><p class="suave" style="font-size:.86rem">Valor padrão de cada brinquedo ao montar uma reserva. Dá para mudar em cada reserva.</p>
        <div class="precos">${brinquedos.map(b => `<label>${esc(b.nome)}<input class="in num" inputmode="decimal" data-id="${b.id}" value="${valorCampo(b.preco)}" placeholder="R$"></label>`).join("")}</div></div>
      <div class="janela-rodape"><button class="btn primario">Salvar preços</button></div></form>`);
    d.querySelector("form").addEventListener("submit", async ev => {
      ev.preventDefault();
      const campos = [...d.querySelectorAll("input[data-id]")];
      for (const c of campos) if (Number.isNaN(centavos(c.value))) return aviso("Valor inválido em " + nomeBrinquedo(c.dataset.id), true);
      await tentar(async () => {
        for (const c of campos) {
          const b = brinquedos.find(x => x.id === c.dataset.id), v = centavos(c.value);
          if (v !== b.preco) { await api("brinquedos/preco", { brinquedo: b.id, valor: v }); b.preco = v; }
        }
      }, "Preços salvos");
      d.close();
    });
  }

  /* ===== Início ===== */
  function mudarMes(delta) {
    const [a, m] = mes.split("-").map(Number);
    const d = new Date(a, m - 1 + delta, 1);
    mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    carregar();
  }
  $("mes-ant").addEventListener("click", () => mudarMes(-1));
  $("mes-prox").addEventListener("click", () => mudarMes(1));
  $("mes").addEventListener("change", ev => { if (/^\d{4}-\d{2}$/.test(ev.target.value)) { mes = ev.target.value; carregar(); } });
  const trocarModo = m => { modo = m; try { localStorage.setItem("maja-modo-reservas", m); } catch {} desenhar(); };
  $("modo-cal").addEventListener("click", () => trocarModo("cal"));
  $("modo-quadro").addEventListener("click", () => trocarModo("quadro"));
  $("btn-nova").addEventListener("click", () => formulario(null));
  $("btn-precos").addEventListener("click", precos);

  (async () => {
    Painel.montarTopo();
    const d = await api("brinquedos");
    brinquedos = d.brinquedos;
    await carregar();
    const abrir = Number(Painel.param("abrir"));
    if (abrir && reservas.some(x => x.id === abrir)) abrirDetalhe(abrir);
    if (Painel.param("nova")) formulario(null);
    if (abrir || Painel.param("nova")) history.replaceState(null, "", "reservas");
  })().catch(() => {});
})();
