"use strict";
(() => {
  const { api, reais, dataBR, hoje, esc, aviso, nomeMes } = Painel;
  const $ = id => document.getElementById(id);
  const barra = (v, max) => `<div class="barra-h"><i style="width:${max ? Math.max(2, Math.round(v / max * 100)) : 0}%"></i></div>`;

  async function carregar() {
    const d = await api(`relatorios?de=${$("de").value}&ate=${$("ate").value}`);
    $("titulo-periodo").textContent = `De ${dataBR(d.de)} a ${dataBR(d.ate)}`;
    const ent = d.faturamento.reduce((s, m) => s + m.entradas, 0), sai = d.faturamento.reduce((s, m) => s + m.saidas, 0);
    const res = d.locacoes.reduce((s, m) => s + m.reservas, 0), brq = d.locacoes.reduce((s, m) => s + m.brinquedos, 0);
    $("totais").innerHTML = `<div class="cartao numero verde"><span>Faturamento</span><b>${reais(ent)}</b></div>
      <div class="cartao numero ${ent - sai >= 0 ? "verde" : "vermelho"}"><span>Resultado (entradas − saídas)</span><b>${reais(ent - sai)}</b></div>
      <div class="cartao numero"><span>Festas atendidas</span><b>${res}</b></div>
      <div class="cartao numero"><span>Ticket médio por festa</span><b>${reais(res ? Math.round(d.porBrinquedo.reduce((s, b) => s + b.valor, 0) / res) : 0)}</b></div>`;
    const maxE = Math.max(0, ...d.faturamento.map(m => m.entradas));
    $("faturamento").innerHTML = d.faturamento.length ? d.faturamento.map(m => `<tr><td>${nomeMes(m.mes)}</td><td class="dir num entrada-cor">${reais(m.entradas)}</td><td class="dir num saida-cor">${reais(m.saidas)}</td><td class="dir num"><b>${reais(m.entradas - m.saidas)}</b></td><td style="width:28%">${barra(m.entradas, maxE)}</td></tr>`).join("")
      : `<tr><td colspan="5" class="vazio">Nenhum lançamento no período.</td></tr>`;
    $("locacoes").innerHTML = d.locacoes.length ? d.locacoes.map(m => `<tr><td>${nomeMes(m.mes)}</td><td class="dir num">${m.reservas}</td><td class="dir num">${m.brinquedos}</td></tr>`).join("")
      + `<tr><td><b>Total</b></td><td class="dir num"><b>${res}</b></td><td class="dir num"><b>${brq}</b></td></tr>` : `<tr><td colspan="3" class="vazio">Nenhuma reserva no período.</td></tr>`;
    const maxB = Math.max(0, ...d.porBrinquedo.map(b => b.valor));
    $("porbrinquedo").innerHTML = d.porBrinquedo.map(b => `<tr${b.qtd ? "" : ' class="suave"'}><td>${esc(b.nome)}</td><td class="dir num">${b.qtd}</td><td class="dir num">${reais(b.valor)}</td><td style="width:28%">${barra(b.valor, maxB)}</td></tr>`).join("");
    $("roi").innerHTML = d.roi.map(b => `<tr><td>${esc(b.nome)}</td><td class="dir num">${b.locacoes}</td><td class="dir num">${reais(b.receita)}</td><td class="dir num">${b.custo ? reais(b.custo) : '<span class="suave">—</span>'}</td><td class="dir num">${reais(b.manutencao)}</td>
      <td class="dir num ${b.lucro >= 0 ? "entrada-cor" : "saida-cor"}">${reais(b.lucro)}</td>
      <td class="dir num">${b.retorno === null ? '<a class="suave nao-imprimir" href="acervo">cadastrar custo</a>' : `<b${b.retorno >= 100 ? ' class="entrada-cor"' : ""}>${b.retorno}%</b>${b.retorno >= 100 ? " ✓" : ""}`}</td></tr>`).join("");
  }

  const h = hoje();
  $("de").value = h.slice(0, 4) + "-01-01"; $("ate").value = h;
  const recarregar = () => carregar().catch(e => aviso(e.message, true));
  $("de").addEventListener("change", recarregar); $("ate").addEventListener("change", recarregar);
  $("btn-imprimir").addEventListener("click", () => print());
  Painel.montarTopo(); recarregar();
})();
