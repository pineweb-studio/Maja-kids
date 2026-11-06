"use strict";
(async () => {
  const { api, reais, dataBR, esc } = Painel;
  const id = Number(Painel.param("id"));
  const folha = document.getElementById("folha");
  try {
    const [r, b] = await Promise.all([api("reservas/uma?id=" + id).then(x => x.reserva), api("brinquedos").then(x => x.brinquedos)]);
    const nome = bid => (b.find(x => x.id === bid) || {}).nome || bid;
    document.title = `Contrato ${r.id} - ${r.cliente_nome} · Maja Kids`;
    const sinal = Math.ceil(r.total / 2);
    const horas = r.tipo_evento === "fechado" ? "fechado, de até 5 horas" : "aberto, de até 4 horas";
    let n = 0; const cl = (t, txt) => `<p class="clausula"><b>Cláusula ${++n}ª – ${t}.</b> ${txt}</p>`;
    folha.innerHTML = `
      <header><img src="../img/logo.webp" alt="Maja Kids"><div class="emp"><b>Maja Kids</b> · locação de brinquedos para festas<br>CNPJ 68.861.909/0001-78<br>WhatsApp (33) 99975-9056</div></header>
      <h1>Contrato de locação de brinquedos</h1>
      <p class="suave">Reserva nº ${r.id}</p>
      <h2>Partes</h2>
      <p><b>LOCADORA:</b> Maja Kids, CNPJ 68.861.909/0001-78, Materlândia (MG), WhatsApp (33) 99975-9056.</p>
      <p><b>LOCATÁRIO(A):</b> ${esc(r.cliente_nome)}${r.documento ? ", CPF/CNPJ " + esc(r.documento) : ", CPF/CNPJ ________________"}, telefone ${esc(r.telefone) || "________________"}${r.email ? ", e-mail " + esc(r.email) : ""}, residente em ${esc(r.endereco_residencial) || "______________________________________"}.</p>
      <h2>Evento</h2>
      <p>Data: <b>${dataBR(r.data)}</b>, das ${esc(r.hora_inicio) || "____"} às ${esc(r.hora_fim) || "____"} (evento ${horas}).<br>Local de montagem: ${esc(r.endereco_montagem) || "______________________________________"}.</p>
      <h2>Itens locados e valores</h2>
      <table><thead><tr><th>Item</th><th class="dir">Valor</th></tr></thead><tbody>
        ${r.itens.map(i => `<tr><td>${esc(nome(i.brinquedo))}</td><td class="dir">${i.valor ? reais(i.valor) : "Cortesia"}</td></tr>`).join("")}
        ${r.taxa_entrega ? `<tr><td>Entrega, montagem e desmontagem</td><td class="dir">${reais(r.taxa_entrega)}</td></tr>` : ""}
        <tr class="total"><td class="dir">Total</td><td class="dir">${reais(r.total)}</td></tr>
      </tbody></table>
      <p>Já pago: ${reais(r.pago)}${r.pagamentos.length ? " (" + r.pagamentos.map(p => `${dataBR(p.data)}: ${reais(p.valor)}${p.forma ? " via " + esc(p.forma) : ""}`).join("; ") + ")" : ""}. Restante: <b>${reais(Math.max(0, r.total - r.pago))}</b>.</p>
      <h2>Cláusulas</h2>
      ${cl("Objeto", "Locação dos brinquedos e serviços listados acima, para uso exclusivo no local, data e horário indicados.")}
      ${cl("Reserva e pagamento", `A data fica reservada com o pagamento do sinal de 50% (${reais(sinal)}). O restante deve ser pago até o dia do evento, antes da montagem.`)}
      ${cl("Entrega e montagem", "A LOCADORA entrega, monta e desmonta os brinquedos. O(A) LOCATÁRIO(A) garante acesso ao local, espaço plano e limpo, e ponto de energia (e de água, quando o brinquedo precisar) próximo à montagem.")}
      ${cl("Uso e segurança", "Os brinquedos devem ser usados conforme as orientações da LOCADORA, respeitando idade, peso e quantidade de crianças por vez. É proibido usar com calçados, objetos cortantes, comida ou bebida dentro do brinquedo, e em caso de chuva ou vento forte.")}
      ${cl("Supervisão e monitoria", "Quando houver monitor contratado, ele orienta o uso dos brinquedos. Em qualquer caso, a supervisão das crianças é de responsabilidade dos pais ou responsáveis presentes no evento.")}
      ${cl("Vistoria e devolução", "Os brinquedos são vistoriados na montagem e na desmontagem. Danos causados por mau uso, fora do desgaste normal, serão cobrados do(a) LOCATÁRIO(A) pelo valor do conserto, mediante comprovação.")}
      ${cl("Atrasos e horário", "O horário de uso é o informado acima. A permanência além do horário depende de disponibilidade e pode ser cobrada à parte, conforme combinado entre as partes.")}
      ${cl("Cancelamento e remarcação", "O cancelamento deve ser avisado pelo WhatsApp. Em caso de chuva ou outro motivo de força maior no dia, as partes combinam uma nova data. Valores pagos e eventual retenção em caso de cancelamento seguem o combinado entre as partes e o Código de Defesa do Consumidor.")}
      ${cl("Demais condições", "Este contrato segue as leis brasileiras. Fica eleito o foro da comarca do(a) LOCATÁRIO(A) para resolver qualquer questão.")}
      ${r.observacoes ? `<h2>Observações</h2><p>${esc(r.observacoes).replace(/\n/g, "<br>")}</p>` : ""}
      <p style="margin-top:24px">Materlândia (MG), ${new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.</p>
      <div class="assin"><div>Maja Kids<br>LOCADORA</div><div>${esc(r.cliente_nome)}<br>LOCATÁRIO(A)</div></div>`;
  } catch (e) { folha.innerHTML = `<p class="erro-msg">${esc(e.message)}</p>`; }
})();
