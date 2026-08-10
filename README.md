# Canto da Esperança — Central de Apoio à Missão

Aplicação web (Next.js + Prisma/Postgres) para o link da bio do Instagram do
projeto **Canto da Esperança** (Missão Laço sem Fim, Moçambique): apresenta a
missão, recebe doações únicas e apoios mensais via Pix/Pix Automático da
OpenPix, cadastra apoiadores e mantém um carrossel público que só exibe um
nome depois que a OpenPix confirma o pagamento por webhook.

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend e backend (route handlers) num único deploy.
- **Prisma 7 + PostgreSQL**, com driver adapter (`@prisma/adapter-pg`).
- **Tailwind CSS v4**, com a paleta/fontes do projeto (navy/dourado/creme, Cormorant Garamond + Inter).
- **zod** para validação de entrada (inclui validação real de CPF).
- **jose + bcryptjs** para a sessão do painel administrativo.
- **vitest** para os testes unitários.

## Como rodar localmente

1. Tenha um Postgres rodando localmente (ou use um serviço gerenciado).
2. `cp .env.example .env` e preencha pelo menos `DATABASE_URL`, `SESSION_SECRET`,
   `ADMIN_EMAIL` e `ADMIN_PASSWORD_HASH` (veja o aviso sobre escapar `$` no
   próprio `.env.example`). Sem `OPENPIX_APP_ID`, os fluxos de pagamento
   respondem com um erro de configuração claro (nunca uma simulação).
3. `npm install`
4. `npx prisma migrate dev` — cria as tabelas.
5. `npm run db:seed` — grava os valores padrão de configuração (taxa de R$0,70 etc).
6. `npm run dev` — abre em http://localhost:3000.

Painel administrativo em `/admin/login`, com o e-mail/senha definidos em
`ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`.

## Testes

```
npm run test    # vitest — regras de negócio puras (taxa, CPF, webhook, carrossel)
npm run lint
npm run build   # type-check + build de produção
```

## Configurando a OpenPix em produção

1. Crie/obtenha o `OPENPIX_APP_ID` da sua conta e configure-o como variável
   de ambiente do backend (nunca no frontend).
2. Cadastre um Webhook na OpenPix apontando para
   `https://SEU_DOMINIO/api/webhooks/openpix`, com uma `authorization`
   própria — copie esse mesmo valor para `OPENPIX_WEBHOOK_AUTHORIZATION`.
3. Habilite pelo menos os eventos `CHARGE_COMPLETED`, `CHARGE_CREATED` e
   `CHARGE_EXPIRED`. Se a sua conta tiver o Pix Automático (BACEN)
   habilitado, habilite também os eventos `PIX_AUTOMATIC_APPROVED`,
   `PIX_AUTOMATIC_REJECTED` e `PIX_AUTOMATIC_COBR_*` — o endpoint já sabe
   tratá-los (`lib/openpix/webhook.ts` e `app/api/webhooks/openpix/route.ts`).
4. A recorrência mensal usa hoje a API de **Subscriptions** da OpenPix
   (`/api/v1/subscriptions`), que é o mecanismo real e documentado da OpenPix
   para gerar cobranças Pix recorrentes automaticamente.

## O que ainda depende de você

- **Assets reais**: os logos e a foto da família em `/public/assets` são
  placeholders (SVG) claramente identificados — substitua pelos arquivos
  finais mantendo os mesmos nomes de arquivo, ou avise para eu trocar.
- **Link do grupo de oração**: configurável em `/admin/settings` (ou na
  tabela `Setting`, chave `prayer_group_url`) sem precisar de deploy.
- **Credenciais reais da OpenPix**: o fluxo de pagamento ponta-a-ponta
  (QR Code, confirmação, Pix Automático) só pode ser validado de verdade
  depois que a conta OpenPix estiver configurada em produção.
