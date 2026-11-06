"use strict";
(async () => {
  const { api, reais, dataBR, esc, telWhats } = Painel;
  Painel.montarTopo();
  const d = await api("semana");
  const NIVEL = { urgente: ["urgente", "Urgente"], atencao: ["", "Atenção"], aviso: ["ok", "Aviso"] };
  const al = document.getElementById("alertas");
  al.innerHTML = d.alertas.length
    ? d.alertas.map(a => `<a class="aviso ${NIVEL[a.nivel][0]}" href="${esc(a.link)}" style="text-decoration:none;justify-content:space-between"><span><b>${NIVEL[a.nivel][1]}:</b> ${esc(a.texto)}</span><span aria-hidden="true">›</span></a>`).join("")
    : `<div class="aviso ok">Nada pendente. Tudo em dia!</div>`;

  const fs = document.getElementById("festas");
  if (!d.festas.length) { fs.innerHTML = `<div class="cartao vazio">Nenhuma festa nos próximos 7 dias.</div>`; return; }
  fs.innerHTML = d.festas.map(f => {
    const dia = new Date(f.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    const falta = f.total - f.pago;
    return `<div class="cartao" style="padding:14px 16px;display:grid;gap:6px">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><b style="font-size:1.05rem">${esc(dia)} · ${esc(f.hora_inicio)}${f.hora_fim ? "–" + esc(f.hora_fim) : ""}</b><span class="selo" data-s="${f.status}">${f.status}</span></div>
      <div><b>${esc(f.cliente_nome)}</b> ${f.telefone ? `· <a href="https://wa.me/${telWhats(f.telefone)}" target="_blank" rel="noopener">${esc(f.telefone)}</a>` : ""}</div>
      <div class="suave">${esc(f.endereco_montagem) || "Endereço não informado"}</div>
      <div>${f.brinquedos.map(esc).join(", ") || "Sem brinquedos"}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="num">Total ${reais(f.total)} · ${falta > 0 ? `<b style="color:var(--acento)">falta ${reais(falta)}</b>` : `<b style="color:var(--verde)">pago</b>`}</span>
        <a class="btn pequeno" href="reservas?abrir=${f.id}&mes=${f.data.slice(0, 7)}">Abrir reserva</a>
      </div></div>`;
  }).join("");
})().catch(e => Painel.aviso(e.message, true));
