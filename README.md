# Maja Kids

Site da Maja Kids, locação de brinquedos para festas infantis. Feito pela Pine Web.

- Site estático: `public/index.html` + `public/img/` (sem build). Painel do dono em `/admin` (veja abaixo).
- Publicação: Cloudflare Pages (projeto `maja-kids`, https://maja-kids.pages.dev) ligado a `pineweb-studio/Maja-kids` (framework: None, build vazio, pasta de saída `public`). Cada push no `main` publica sozinho.
- Reservas: o cliente monta a festa no site e envia pelo WhatsApp (33) 99975-9056.

## Painel do dono (/admin)

Painel com senha para a Maja Kids controlar as reservas, no mesmo visual do site. Roda grátis no próprio Cloudflare:

- `functions/api/[[rota]].js`: servidor (Cloudflare Pages Functions). Rotas públicas: `GET /api/disponibilidade?data=AAAA-MM-DD` (só diz quais brinquedos estão ocupados). Painel: `/api/admin/...`, todas com login.
- `lib/`: banco (tabelas criadas sozinhas na primeira chamada), senha/sessões e reservas.
- `public/admin/`: páginas do painel (`index.html` = login, `reservas.html`).
- Banco: Cloudflare D1 (SQLite). Dinheiro em centavos, datas em AAAA-MM-DD. Todo pagamento vira um lançamento no financeiro (`lancamentos`).
- Segurança: senha só no Cloudflare (segredo `ADMIN_SENHA`) e, depois de trocada no painel, só o hash PBKDF2 no banco; cookie de sessão HttpOnly de 7 dias; 5 senhas erradas bloqueiam o IP por 15 min; POST de outro site é recusado.

### Ligar no Cloudflare (uma vez só)

1. Cloudflare > Storage & Databases > D1 > **Create database**, nome `maja-kids`.
2. Workers & Pages > projeto `maja-kids` > Settings > **Bindings** > Add > D1 database: nome da variável `DB`, banco `maja-kids` (em Production e Preview).
3. Settings > **Variables and Secrets** > Add > tipo *Secret*, nome `ADMIN_SENHA`, valor = senha do painel (mínimo 10 caracteres).
4. Faça um novo deploy (Deployments > Retry deployment, ou um push no `main`).
5. Abra https://maja-kids.pages.dev/admin/, entre com a senha e use **Trocar senha**.

### Testar no computador

`npx wrangler pages dev public --d1 DB=local-maja` com um arquivo `.dev.vars` contendo `ADMIN_SENHA=uma-senha-de-teste`. Abra http://localhost:8788/admin/.

### Próximas partes

Semana (alertas), Orçamentos (com pedido pelo site), Acervo e manutenção, Eventos e ingressos, Financeiro, Relatórios e Contrato, seguindo a primeira versão.

Pendências: fotos reais dos eventos, avaliações de clientes, fotos da máquina de espuma e da máquina de bolha.

Documentação completa: `docs/Maja-Kids-documentacao-do-site.pdf`.

(Site feito por [Fellipe Pinho](https://github.com/felliperobertopinhopires-tech) · PineWeb)
