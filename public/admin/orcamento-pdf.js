"use strict";
(async () => {
  const { api, reais, dataBR, esc } = Painel;
  const id = Number(Painel.param("id"));
  const folha = document.getElementById("folha");
  try {
    const o = (await api("orcamentos/um?id=" + id)).orcamento;
    document.title = `Orçamento ${o.id} - ${o.cliente_nome} · Maja Kids`;
    const sub = o.itens.reduce((s, i) => s + i.quantidade * i.valor, 0);
    folha.innerHTML = `
      <header><img src="../img/logo.webp" alt="Maja Kids"><div class="emp"><b>Maja Kids</b> · locação de brinquedos para festas<br>CNPJ 68.861.909/0001-78<br>WhatsApp (33) 99975-9056 · @majakidslocacoes<br>Materlândia (MG) e região</div></header>
      <h1>Orçamento nº ${o.id}</h1>
      <p class="suave">Emitido em ${dataBR(o.criado_em.slice(0, 10))} · válido até ${dataBR(o.validade)}</p>
      <h2>Cliente</h2>
      <p><b>${esc(o.cliente_nome)}</b>${o.telefone ? " · " + esc(o.telefone) : ""}${o.email ? " · " + esc(o.email) : ""}</p>
      <h2>Evento</h2>
      <p>${o.evento_data ? dataBR(o.evento_data) : "Data a combinar"}${o.evento_tipo ? " · " + esc(o.evento_tipo) : ""}${o.endereco ? "<br>" + esc(o.endereco) : ""}</p>
      <h2>Itens</h2>
      <table><thead><tr><th>Descrição</th><th class="dir">Qtd.</th><th class="dir">Valor unit.</th><th class="dir">Total</th></tr></thead><tbody>
        ${o.itens.map(i => `<tr><td>${esc(i.descricao)}</td><td class="dir">${i.quantidade}</td><td class="dir">${i.valor ? reais(i.valor) : "Brinde"}</td><td class="dir">${reais(i.quantidade * i.valor)}</td></tr>`).join("")}
        <tr><td colspan="3" class="dir">Subtotal</td><td class="dir">${reais(sub)}</td></tr>
        ${o.taxa_entrega ? `<tr><td colspan="3" class="dir">Entrega e montagem</td><td class="dir">${reais(o.taxa_entrega)}</td></tr>` : ""}
        ${o.desconto ? `<tr><td colspan="3" class="dir">Desconto</td><td class="dir">- ${reais(o.desconto)}</td></tr>` : ""}
        <tr class="total"><td colspan="3" class="dir">Total</td><td class="dir">${reais(o.total)}</td></tr>
      </tbody></table>
      ${o.condicoes ? `<h2>Condições de pagamento</h2><p>${esc(o.condicoes).replace(/\n/g, "<br>")}</p>` : ""}
      ${o.observacoes && o.origem !== "site" ? `<h2>Observações</h2><p>${esc(o.observacoes).replace(/\n/g, "<br>")}</p>` : ""}
      <p class="suave" style="margin-top:24px;font-size:12px">A data só fica reservada depois da confirmação e do pagamento do sinal. Valores válidos até a data acima.</p>`;
  } catch (e) { folha.innerHTML = `<p class="erro-msg">${esc(e.message)}</p>`; }
})();
