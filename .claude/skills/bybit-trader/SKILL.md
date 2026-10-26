---
name: bybit-trader
description: >-
  Operador Bybit (cripto, API v5). Testa estrategias classicas (tendencia por
  EMAs, rompimento Donchian com volume, reversao a media por RSI) em dados
  reais com taxas e deslizamento, separando treino e teste para nao enganar;
  procura sinais na watchlist; calcula stop por ATR e alvo em R; dimensiona a
  posicao pelo risco (1% do patrimonio por padrao) e checa limites diarios,
  alavancagem e minimos do par; e envia a ordem com stop-loss e take-profit na
  Bybit, testnet por padrao, nunca sem o "sim" do usuario. Futuros perpetuos
  USDT (linear) ou spot. Use quando o usuario disser "bybit", "cripto",
  "bitcoin", "operar BTC", "backtest", "qual estrategia funciona", "tem sinal
  agora", "abre uma operacao", "compra/vende na bybit", "fecha minha posicao",
  "meu saldo na bybit", "configurar a bybit".
argument-hint: "[backtest | scan | signal PAR | size | show | place | close PAR | balance]"
---

# bybit-trader

Esta skill ajuda o usuario a operar cripto na Bybit com regras fixas. Ela
**nao** opera sozinha. Cada ordem passa por tres travas, sempre:

1. **Checagem de risco PASS** para aquela ordem exata (`size`).
2. **O usuario digita "sim"** no chat para aquela ordem, e voce passa a
   resposta dele, palavra por palavra, em `--reply`.
3. **O cartao de permissao do Claude** para o comando `place`. Nunca coloque
   `bybit.py place` ou `close` em "allow" nas configuracoes.

Sem as tres, nada e enviado. Nunca invente o "sim", nunca reaproveite um "sim"
de outra ordem, nunca rode `place` num loop ou num agendamento.

`${CLAUDE_SKILL_DIR}` e a pasta desta skill. No Windows, se `python3` nao existir
(ou abrir a Microsoft Store), use `python` nos mesmos comandos.

```bash
python3 "${CLAUDE_SKILL_DIR}/bybit.py" backtest --write                 # testa as 3 estrategias na watchlist
python3 "${CLAUDE_SKILL_DIR}/bybit.py" backtest --symbols BTCUSDT --interval 240
python3 "${CLAUDE_SKILL_DIR}/bybit.py" scan                             # sinais agora, na ultima vela fechada
python3 "${CLAUDE_SKILL_DIR}/bybit.py" signal BTCUSDT --write           # -> trader-bybit/plan.json
python3 "${CLAUDE_SKILL_DIR}/bybit.py" size                             # -> trader-bybit/orders.json, PASS/BLOCK
python3 "${CLAUDE_SKILL_DIR}/bybit.py" show
python3 "${CLAUDE_SKILL_DIR}/bybit.py" place --index 1 --reply "sim"    # so depois do sim do usuario
python3 "${CLAUDE_SKILL_DIR}/bybit.py" positions
python3 "${CLAUDE_SKILL_DIR}/bybit.py" close BTCUSDT --reply "sim"
python3 "${CLAUDE_SKILL_DIR}/bybit.py" balance
python3 "${CLAUDE_SKILL_DIR}/bybit.py" journal
```

`--offline ARQUIVO` em backtest/scan/signal usa velas salvas em vez da internet.
Estado em `trader-bybit/` (config.json, plan.json, orders.json, backtest.json, journal.json).

## As estrategias (e a verdade sobre elas)

| nome | entrada | stop | alvo |
| --- | --- | --- | --- |
| `trend` | EMA9 cruza a EMA21 a favor da EMA200 | 2 ATR | 2R |
| `breakout` | fecha alem da maxima/minima de 20 velas, volume > 1,5x a media, a favor da EMA200 | 1,5 ATR | 2R |
| `meanrev` | RSI14 sai de 30 (alta, acima da EMA200) ou de 70 (baixa, abaixo da EMA200) | 1,5 ATR | 1,5R |

Sinal so na vela **fechada**. No backtest a entrada e na abertura da vela
seguinte, com taxa (0,055% futuros / 0,1% spot, taker) e 0,02% de deslizamento
em cada lado. Se uma vela toca stop e alvo, conta o stop. Os primeiros 70% dos
dados sao treino, os ultimos 30% sao teste. APROVADA = lucro medio positivo nos
dois e fator de lucro >= 1,1 no teste, com pelo menos 10 operacoes em cada.

**Nao existe "a melhor estrategia".** Em outubro de 2026, rodando em dados
reais de BTC, ETH e SOL (1h, abr-out 2026; 4h, jul 2024-out 2026), `trend` e
`breakout` lucraram no treino e **perderam no teste**, e `meanrev` teve poucas
operacoes para concluir. Nenhuma foi aprovada. Diga isso ao usuario com
todas as letras e nao ajuste parametros ate algo "passar": isso e decorar o
passado (overfitting) e costuma perder dinheiro de verdade. Rode o backtest
de novo, com dados atuais, antes de qualquer decisao.

## Como conduzir uma operacao

1. **Backtest primeiro** (`backtest --write`). Mostre a tabela. Na **mainnet**,
   `size` bloqueia qualquer estrategia que nao esteja APROVADA para aquele par
   e tempo grafico. Na testnet pode treinar com qualquer uma, avisando que e treino.
2. `scan` ou `signal PAR --write`. Sem sinal = esperar. Nao force entrada.
3. `size`. Le o saldo, o tick e o passo do par na Bybit. Mostre o ticket de `show`
   inteiro: lado, quantidade, entrada, stop, alvo, perda no stop em USDT,
   alavancagem e qual limite decidiu o tamanho. BLOCK e final: explique o motivo
   e pare.
4. Pergunte: "Envio esta ordem para a TESTNET/MAINNET? Responda sim ou nao."
   So com um sim claro rode `place --index N --reply "<resposta exata>"`.
5. Depois: `positions`. O stop e o alvo ficam na Bybit. Para sair antes:
   `close PAR`, tambem com o sim do usuario. Sair nunca e bloqueado por limite.

Ordens em futuros (`linear`): Market com `stopLoss`/`takeProfit` (tpslMode Full,
gatilho pelo ultimo preco), modo one-way (`positionIdx` 0). A alavancagem e
ajustada antes, limitada a `max_leverage` (padrao 2x, teto rigido 10x). Spot:
Limit GTC no preco de entrada com TP/SL anexados, so compra.

## Configuracao (o que o usuario faz)

Diga ao usuario, passo a passo:

1. **Rodar no proprio computador.** A Bybit bloqueia servidores de alguns paises
   (EUA inclusive, HTTP 403). Sessoes do Claude Code na nuvem nao alcancam a
   API. Use o Claude Code no computador dele (terminal ou app desktop), com
   Python 3.8+.
2. **Conta testnet:** testnet.bybit.com, criar conta, pedir moedas de teste
   (Assets > "Request Test Coins").
3. **Chave de API na testnet:** perfil > API > Create New Key > System-generated.
   Permissoes: Read-Write; marcar **Contract - Orders/Positions** (futuros) e/ou
   **SPOT - Trade**. **Nunca** marcar Withdrawal/Transfer. Se possivel, restringir
   ao IP dele.
4. **Chaves no terminal, nunca no chat:**
   - macOS/Linux: `export BYBIT_API_KEY=...` e `export BYBIT_API_SECRET=...`
     (ou num `.env` fora do git)
   - Windows PowerShell: `$env:BYBIT_API_KEY="..."`
   Se o usuario colar uma chave no chat, mande apagar a mensagem e gerar outra.
   Nunca peca, leia ou repita chaves.
5. **Config:** `mkdir trader-bybit && cp "${CLAUDE_SKILL_DIR}/config.example.json" trader-bybit/config.json`,
   e ajustar `category` (`linear` = futuros, `spot`), `watchlist`, `interval`,
   `risk_pct` (% do patrimonio perdido se bater o stop) e os limites diarios.
6. **Conta real, so depois de semanas na testnet:** criar a chave na
   bybit.com com as mesmas regras (sem saque), `"mainnet": true` no config
   **e** `BYBIT_MAINNET=1` no ambiente. As duas travas sao necessarias. Comece
   com pouco dinheiro.

Os precos da testnet podem ser bem diferentes dos reais; o backtest sempre usa
dados publicos da mainnet. O codigo foi testado offline (assinatura, tamanho,
travas); confirme na testnet que as ordens saem como esperado antes de
qualquer coisa real.

## Avisos

Nao e recomendacao financeira. A maioria de quem faz day trade perde dinheiro,
e alavancagem acelera as perdas e pode liquidar a posicao. Stop nao e garantia:
em movimento brusco a ordem pode executar bem pior. Lucro em cripto pode ter
imposto (no Brasil, declarar e apurar conforme as regras da Receita).
