"use strict";
(() => {
  const { api, reais, centavos, valorCampo, dataBR, hoje, esc, aviso, tentar, formulario, campo, baixarCSV, nomeMes, MESES } = Painel;
  const $ = id => document.getElementById(id);
  const NOMES = { reserva: "Reservas", devolucao: "Devoluções", orcamento: "Orçamentos aprovados", evento: "Eventos", manutencao: "Manutenção", despesa_fixa: "Despesas fixas", outros: "Outros" };
  const nomeCat = c => NOMES[c] || (c.startsWith("manual-") ? NOMES[c.slice(7)] || c.slice(7) : c.charAt(0).toUpperCase() + c.slice(1));
  const REPETE = { 1: "Todo mês", 2: "A cada 2 meses", 3: "A cada 3 meses", 6: "A cada 6 meses", 12: "Uma vez por ano" };
  const valor = (v, rot) => { const c = centavos(v); if (Number.isNaN(c)) throw new Error(rot + " inválido."); return c; };
  let dados = null, despesas = [], brinquedos = [];

  function datas() {
    const h = hoje(), a = +h.slice(0, 4), m = +h.slice(5, 7);
    const fimMes = (ano, mes) => `${ano}-${String(mes).padStart(2, "0")}-${new Date(ano, mes, 0).getDate()}`;
    const voltar = n => { const d = new Date(a, m - 1 - n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
    switch ($("periodo").value) {
      case "3m": return [voltar(2), fimMes(a, m)];
      case "6m": return [voltar(5), fimMes(a, m)];
      case "ano": return [`${a}-01-01`, `${a}-12-31`];
      case "anopassado": return [`${a - 1}-01-01`, `${a - 1}-12-31`];
      case "livre": return [$("de").value || voltar(0), $("ate").value || fimMes(a, m)];
      default: return [voltar(0), fimMes(a, m)];
    }
  }

  const tabelaCat = (obj, total) => {
    const l = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    return l.length ? l.map(([c, v]) => `<tr><td>${esc(nomeCat(c))}</td><td style="width:35%"><div class="barra-h"><i style="width:${total ? Math.round(v / total * 100) : 0}%"></i></div></td><td class="dir num">${reais(v)}</td></tr>`).join("")
      : `<tr><td class="vazio">Nada no período.</td></tr>`;
  };

  async function carregar() {
    const [de, ate] = datas();
    $("datas-livres").hidden = $("periodo").value !== "livre";
    dados = await api(`financeiro/lista?de=${de}&ate=${ate}`);
    $("titulo-periodo").textContent = `De ${dataBR(dados.de)} a ${dataBR(dados.ate)}`;
    const t = dados.totais;
    $("totais").innerHTML = `<div class="cartao numero verde"><span>Entradas</span><b>${reais(t.entradas)}</b></div>
      <div class="cartao numero vermelho"><span>Saídas</span><b>${reais(t.saidas)}</b></div>
      <div class="cartao numero ${t.saldo >= 0 ? "verde" : "vermelho"}"><span>Saldo</span><b>${reais(t.saldo)}</b></div>
      <div class="cartao numero"><span>A receber (próximos 30 dias)</span><b>${reais(dados.receber.total)}</b></div>`;
    const rec = r => `<tr><td>${dataBR(r.data)}</td><td><a href="reservas?abrir=${r.id}&mes=${r.data.slice(0, 7)}">${esc(r.cliente_nome)}</a></td><td class="dir num">${reais(r.total)}</td><td class="dir num">${reais(r.pago)}</td><td class="dir num"><b>${reais(r.falta)}</b></td></tr>`;
    const cab = `<thead><tr><th>Festa</th><th>Cliente</th><th class="dir">Total</th><th class="dir">Pago</th><th class="dir">Falta</th></tr></thead>`;
    $("receber").innerHTML = (dados.receber.atrasados.length ? `<div class="aviso urgente" style="margin-bottom:8px">Festas que já passaram e ainda têm valor a receber:</div><div class="rolagem" style="margin-bottom:12px"><table class="lista-tab">${cab}<tbody>${dados.receber.atrasados.map(rec).join("")}</tbody></table></div>` : "")
      + (dados.receber.proximos.length ? `<div class="rolagem"><table class="lista-tab">${cab}<tbody>${dados.receber.proximos.map(rec).join("")}</tbody></table></div>`
        : dados.receber.atrasados.length ? "" : `<div class="cartao vazio">Nada a receber nos próximos 30 dias.</div>`);
    $("meses").innerHTML = dados.meses.length ? dados.meses.map(m => `<tr><td>${nomeMes(m.mes)}</td><td class="dir num entrada-cor">${reais(m.entradas)}</td><td class="dir num saida-cor">${reais(m.saidas)}</td><td class="dir num"><b>${reais(m.saldo)}</b></td></tr>`).join("")
      : `<tr><td colspan="4" class="vazio">Nenhum lançamento no período.</td></tr>`;
    $("cat-entrada").innerHTML = tabelaCat(dados.categorias.entrada, t.entradas);
    $("cat-saida").innerHTML = tabelaCat(dados.categorias.saida, t.saidas);
    $("alugueis").innerHTML = dados.alugueis.length ? dados.alugueis.map(a => `<tr><td>${esc(a.nome)}</td><td class="dir num">${a.qtd}x</td><td class="dir num">${reais(a.valor)}</td></tr>`).join("") : `<tr><td class="vazio">Nenhum aluguel no período.</td></tr>`;
    $("lancamentos").innerHTML = dados.lancamentos.length ? dados.lancamentos.map(l => `<tr><td>${dataBR(l.data)}</td><td>${esc(l.descricao) || "—"}</td>
      <td>${esc(nomeCat(l.categoria))}${l.automatico ? `<br><span class="suave" style="font-size:.78rem">automático · ${esc(l.automatico)}</span>` : ""}</td>
      <td class="dir num ${l.tipo === "entrada" ? "entrada-cor" : "saida-cor"}">${l.tipo === "entrada" ? "+" : "−"} ${reais(l.valor)}</td>
      <td class="dir nao-imprimir">${l.automatico ? "" : `<button class="btn link" data-l="${l.id}" aria-label="Apagar lançamento">✕</button>`}</td></tr>`).join("")
      : `<tr><td colspan="5" class="vazio">Nenhum lançamento no período.</td></tr>`;
    $("lancamentos").querySelectorAll("[data-l]").forEach(b => b.addEventListener("click", () => {
      if (confirm("Apagar este lançamento?")) tentar(() => api("financeiro/remover", { id: Number(b.dataset.l) }), "Lançamento apagado").then(carregar, () => {});
    }));
  }

  async function carregarDespesas() {
    despesas = (await api("despesas/lista")).despesas;
    $("despesas").innerHTML = despesas.length ? despesas.map(d => `<tr${d.ativa ? "" : ' class="suave"'}><td>${esc(d.descricao)}${d.ativa ? "" : " (pausada)"}</td><td>${esc(nomeCat(d.categoria))}</td><td>${d.dia}</td><td>${REPETE[d.a_cada]}</td><td class="dir num">${reais(d.valor)}</td>
      <td class="dir" style="white-space:nowrap"><button class="btn link" data-d="${d.id}">Editar</button><button class="btn link" data-dx="${d.id}" aria-label="Apagar despesa fixa">✕</button></td></tr>`).join("")
      : `<tr><td colspan="6" class="vazio">Nenhuma despesa fixa. Ex.: aluguel do galpão, internet, contador.</td></tr>`;
    $("despesas").querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => despesa(despesas.find(d => d.id === Number(b.dataset.d)))));
    $("despesas").querySelectorAll("[data-dx]").forEach(b => b.addEventListener("click", () => {
      if (confirm("Apagar esta despesa fixa? Ela para de ser lançada; o que já foi lançado continua no financeiro.")) tentar(() => api("despesas/remover", { id: Number(b.dataset.dx) }), "Despesa fixa apagada").then(carregarDespesas, () => {});
    }));
  }

  function despesa(d) {
    d = d || { descricao: "", categoria: "despesa_fixa", valor: 0, dia: 10, a_cada: 1, inicio: hoje().slice(0, 7), ativa: 1 };
    formulario(d.id ? "Editar despesa fixa" : "Nova despesa fixa", `
      ${campo("Descrição", "descricao", `maxlength="120" required value="${esc(d.descricao)}" placeholder="Ex.: Aluguel do galpão"`, true)}
      ${campo("Valor (R$)", "valor", `inputmode="decimal" required value="${valorCampo(d.valor)}"`)}
      ${campo("Vence todo dia", "dia", `inputmode="numeric" value="${d.dia}"`)}
      <div class="campo"><label for="f-a_cada">Repete</label><select id="f-a_cada" name="a_cada">${Object.entries(REPETE).map(([k, n]) => `<option value="${k}"${+k === d.a_cada ? " selected" : ""}>${n}</option>`).join("")}</select></div>
      ${campo("Começa no mês", "inicio", `type="month" value="${esc(d.inicio)}"`)}
      ${campo("Categoria", "categoria", `maxlength="40" value="${esc(d.categoria === "despesa_fixa" ? "" : d.categoria)}" placeholder="Despesas fixas"`)}
      <label class="largo" style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="ativa" ${d.ativa ? "checked" : ""}> Ativa (lança sozinha)</label>`,
      async f => {
        await api("despesas/salvar", { ...f, id: d.id, valor: valor(f.valor, "Valor"), dia: Number(f.dia), a_cada: Number(f.a_cada) });
        aviso("Despesa fixa salva"); carregarDespesas(); carregar();
      });
  }

  function lancamento() {
    const cats = [...new Set(["aluguel", "combustível", "material", "salário", "impostos", "propaganda", "outros", ...(dados ? dados.lancamentos.filter(l => !l.automatico).map(l => l.categoria) : [])])];
    formulario("Novo lançamento", `
      <div class="campo"><label for="f-tipo">Tipo</label><select id="f-tipo" name="tipo"><option value="saida">Saída (gasto)</option><option value="entrada">Entrada (recebi)</option></select></div>
      ${campo("Valor (R$)", "valor", 'inputmode="decimal" required')}
      ${campo("Data", "data", `type="date" value="${hoje()}"`)}
      ${campo("Categoria", "categoria", 'maxlength="40" list="cats" placeholder="Ex.: combustível"')}<datalist id="cats">${cats.map(c => `<option value="${esc(c)}">`).join("")}</datalist>
      ${campo("Descrição", "descricao", 'maxlength="200"', true)}
      <div class="campo largo"><label for="f-brinquedo">Brinquedo (opcional)</label><select id="f-brinquedo" name="brinquedo"><option value="">Nenhum</option>${brinquedos.map(b => `<option value="${b.id}">${esc(b.nome)}</option>`).join("")}</select></div>`,
      async f => { await api("financeiro/adicionar", { ...f, valor: valor(f.valor, "Valor") }); aviso("Lançamento feito"); carregar(); }, { botao: "Lançar" });
  }

  function csv() {
    if (!dados) return;
    baixarCSV(`financeiro-maja-kids-${dados.de}-a-${dados.ate}.csv`, [
      ["Data", "Tipo", "Categoria", "Descrição", "Valor (R$)"],
      ...dados.lancamentos.map(l => [dataBR(l.data), l.tipo === "entrada" ? "Entrada" : "Saída", nomeCat(l.categoria), l.descricao, ((l.tipo === "entrada" ? 1 : -1) * l.valor / 100).toFixed(2).replace(".", ",")]),
      [], ["", "", "", "Entradas", (dados.totais.entradas / 100).toFixed(2).replace(".", ",")],
      ["", "", "", "Saídas", (dados.totais.saidas / 100).toFixed(2).replace(".", ",")],
      ["", "", "", "Saldo", (dados.totais.saldo / 100).toFixed(2).replace(".", ",")]
    ]);
  }

  const recarregar = () => carregar().catch(e => aviso(e.message, true));
  $("periodo").addEventListener("change", () => {
    if ($("periodo").value === "livre" && !$("de").value) { const [de, ate] = datas(); $("de").value = de; $("ate").value = ate; }
    recarregar();
  });
  $("de").addEventListener("change", recarregar); $("ate").addEventListener("change", recarregar);
  $("btn-csv").addEventListener("click", csv);
  $("btn-imprimir").addEventListener("click", () => print());
  $("btn-novo").addEventListener("click", lancamento);
  $("btn-despesa").addEventListener("click", () => despesa());
  (async () => {
    Painel.montarTopo();
    brinquedos = (await api("brinquedos")).brinquedos;
    await Promise.all([carregar(), carregarDespesas()]);
  })().catch(e => aviso(e.message, true));
})();
