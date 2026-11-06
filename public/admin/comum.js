// Funções comuns do painel: chamar o servidor, formatar reais e datas, montar o menu.
// Cada página do painel carrega este arquivo antes do seu próprio script.
"use strict";
const Painel = (() => {
  const PAGINAS = [
    { href: "semana", nome: "Semana" },
    { href: "reservas", nome: "Reservas" },
    { href: "orcamentos", nome: "Orçamentos" },
    { href: "acervo", nome: "Acervo" },
    { href: "eventos", nome: "Eventos" },
    { href: "financeiro", nome: "Financeiro" },
    { href: "relatorios", nome: "Relatórios" }
  ];

  async function api(rota, corpo) {
    const op = corpo === undefined
      ? { method: "GET", credentials: "same-origin" }
      : { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
    let r;
    try { r = await fetch("/api/admin/" + rota, op); } catch { throw new Error("Sem conexão. Confira a internet."); }
    const dados = await r.json().catch(() => ({}));
    if (r.status === 401 && rota !== "login") { location.href = "./?voltar=" + encodeURIComponent(location.pathname); throw new Error("Entre com a senha."); }
    if (!r.ok) throw new Error(dados.erro || "Erro " + r.status);
    return dados;
  }

  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const reais = c => fmt.format((c || 0) / 100);
  // "1.234,56" ou "1234.56" ou "150" -> centavos (inteiro)
  function centavos(txt) {
    let s = String(txt || "").replace(/[^\d,.-]/g, "");
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Math.round(parseFloat(s) * 100);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }
  const valorCampo = c => c ? (c / 100).toFixed(2).replace(".", ",") : "";
  const dataBR = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let timer;
  function aviso(msg, erro = false) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle("erro", erro); t.classList.add("ver");
    clearTimeout(timer); timer = setTimeout(() => t.classList.remove("ver"), erro ? 5000 : 2600);
  }

  // Roda uma ação mostrando o erro, se houver
  async function tentar(fn, ok) {
    try { const r = await fn(); if (ok) aviso(ok); return r; }
    catch (e) { aviso(e.message, true); throw e; }
  }

  function montarTopo() {
    const atual = location.pathname.split("/").pop().replace(/\.html$/, "");
    const topo = document.createElement("header");
    topo.className = "topo";
    topo.innerHTML = `<div class="miolo">
      <a class="marca" href="semana"><img src="../img/logo.webp" alt="Maja Kids"><span>Painel</span></a>
      <nav aria-label="Painel">${PAGINAS.map(p => `<a href="${p.href}"${p.href === atual ? ' aria-current="page"' : ""}>${p.nome}</a>`).join("")}</nav>
      <div class="conta"><button class="btn link" id="btn-senha">Trocar senha</button><button class="btn link" id="btn-sair">Sair</button></div>
    </div>`;
    document.body.prepend(topo);
    topo.querySelector("#btn-sair").addEventListener("click", async () => {
      await api("sair", {}).catch(() => {});
      location.href = "./";
    });
    topo.querySelector("#btn-senha").addEventListener("click", trocarSenha);
  }

  function trocarSenha() {
    const d = document.createElement("dialog");
    d.innerHTML = `<form method="dialog">
      <div class="janela-topo"><h2>Trocar senha</h2><button class="fechar" value="x" aria-label="Fechar">×</button></div>
      <div class="janela-corpo">
        <div class="campo"><label for="s-atual">Senha atual</label><input id="s-atual" type="password" autocomplete="current-password" required></div>
        <div class="campo"><label for="s-nova">Senha nova (mínimo 10 caracteres)</label><input id="s-nova" type="password" autocomplete="new-password" minlength="10" required></div>
        <p class="erro-msg" aria-live="polite"></p>
      </div>
      <div class="janela-rodape"><button class="btn primario" value="ok">Trocar</button></div>
    </form>`;
    document.body.appendChild(d);
    d.addEventListener("close", () => d.remove());
    d.querySelector("form").addEventListener("submit", async ev => {
      if (ev.submitter && ev.submitter.value === "x") return;
      ev.preventDefault();
      try {
        const r = await api("trocar-senha", { atual: d.querySelector("#s-atual").value, nova: d.querySelector("#s-nova").value });
        alert(r.mensagem); location.href = "./";
      } catch (e) { d.querySelector(".erro-msg").textContent = e.message; }
    });
    d.showModal();
  }

  // Janela (dialog) genérica; elementos com data-fechar fecham
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
  const somarDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const nomeMes = m => { const [a, n] = m.split("-"); return MESES[+n - 1].slice(0, 3) + "/" + a.slice(2); };
  const param = n => new URLSearchParams(location.search).get(n);
  // Baixar planilha CSV (abre no Excel/Numbers; ; como separador por causa da vírgula decimal)
  function baixarCSV(nome, linhas) {
    const csv = "\ufeff" + linhas.map(l => l.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // Formulário em janela: campos em HTML; enviar(dados, janela) recebe os campos com name
  function formulario(titulo, campos, enviar, { botao = "Salvar", extra = "" } = {}) {
    const d = janela(`<form novalidate>
      <div class="janela-topo"><h2>${titulo}</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">×</button></div>
      <div class="janela-corpo"><div class="grade-campos">${campos}</div><p class="erro-msg" aria-live="polite"></p></div>
      <div class="janela-rodape">${extra}<button class="btn primario">${botao}</button></div></form>`);
    d.querySelector("form").addEventListener("submit", async ev => {
      ev.preventDefault();
      const dados = Object.fromEntries([...d.querySelectorAll("[name]")].map(i => [i.name, i.type === "checkbox" ? i.checked : i.value]));
      try { await enviar(dados, d); d.close(); } catch (e) { d.querySelector(".erro-msg").textContent = e.message; }
    });
    const p = d.querySelector("input,select,textarea"); if (p) p.focus();
    return d;
  }
  const campo = (rotulo, nome, attrs = "", largo = false) => `<div class="campo${largo ? " largo" : ""}"><label for="f-${nome}">${rotulo}</label><input id="f-${nome}" name="${nome}" ${attrs}></div>`;
  const telWhats = t => { let n = String(t || "").replace(/\D/g, ""); if (n.length <= 11) n = "55" + n; return n; };

  return { api, reais, centavos, valorCampo, dataBR, hoje, esc, aviso, tentar, montarTopo, janela, somarDias, nomeMes, param, baixarCSV, telWhats, MESES, formulario, campo };
})();
