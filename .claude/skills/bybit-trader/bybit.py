#!/usr/bin/env python3
"""bybit-trader: dados, estrategias, backtest, tamanho da posicao, checagem de
risco e ordens na Bybit (API v5). So biblioteca padrao do Python 3.8+.

Testnet por padrao. Uma ordem so sai pelo comando `place`, so para uma ordem
que passou na checagem de risco (PASS), e so com o "sim" do usuario gravado
palavra por palavra. Chaves vem de variaveis de ambiente, nunca do chat:

  BYBIT_API_KEY, BYBIT_API_SECRET     chaves da API (testnet ou mainnet)
  BYBIT_MAINNET=1                     junto com "mainnet": true no config, libera conta real
  BYBIT_TRADER_DIR                    pasta de estado (padrao: trader-bybit)

Comandos:
  backtest  testa as estrategias em dados reais (mainnet, publico) com taxas
  scan      procura sinais agora em toda a watchlist
  signal    calcula o sinal de um par e grava trader-bybit/plan.json
  size      transforma o plano em ordem (quantidade, stop, alvo) + checagem de risco
  show      mostra as ordens em portugues claro
  place     envia uma ordem PASS, so com --reply "sim"
  close     fecha a posicao de um par (sempre permitido, tambem pede "sim")
  balance   saldo da conta     positions   posicoes abertas     journal   historico
"""
import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import ROUND_DOWN, ROUND_UP, Decimal

MAINNET = "https://api.bybit.com"
TESTNET = "https://api-testnet.bybit.com"
UA = "bybit-trader-skill/1.0"
WARMUP = 201
HARD_MAX_LEVERAGE = 10
YES = {"sim", "s", "yes", "y", "confirmo", "confirmado", "sim pode enviar", "pode enviar"}
INTERVAL_MIN = {"1": 1, "3": 3, "5": 5, "15": 15, "30": 30, "60": 60, "120": 120, "240": 240,
                "360": 360, "720": 720, "D": 1440, "W": 10080}
STRATEGIES = ("trend", "breakout", "meanrev")
STRATEGY_INFO = {
    "trend": "Seguidora de tendencia: EMA9 cruza a EMA21 a favor da EMA200; stop 2 ATR, alvo 2R",
    "breakout": "Rompimento Donchian: fecha alem da maxima/minima de 20 velas com volume 1,5x, a favor da EMA200; stop 1,5 ATR, alvo 2R",
    "meanrev": "Reversao a media: RSI14 sai de sobrevenda (30) numa tendencia de alta, ou de sobrecompra (70) numa de baixa; stop 1,5 ATR, alvo 1,5R",
}
DEFAULTS = {
    "category": "linear",
    "mainnet": False,
    "watchlist": ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"],
    "interval": "60",
    "strategies": {},
    "risk_pct": 1.0,
    "daily_loss_limit_pct": 3.0,
    "max_trades_per_day": 4,
    "max_leverage": 2,
    "max_position_pct": 50.0,
    "min_rr": 1.5,
    "allow_short": True,
    "fee_pct": None,
    "slippage_pct": 0.02,
    "blocked": [],
    "max_signal_age_bars": 1,
    "order_ttl_minutes": 15,
}

_urlopen = urllib.request.urlopen   # tests swap these
_now = time.time


class BybitError(Exception):
    def __init__(self, msg, code=None):
        super().__init__(msg)
        self.code = code


# ---------------------------------------------------------------- state files

def state_dir():
    return os.environ.get("BYBIT_TRADER_DIR", "trader-bybit")


def path(name):
    return os.path.join(state_dir(), name)


def load_json(name, default):
    try:
        with open(path(name)) as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(name, data):
    os.makedirs(state_dir(), exist_ok=True)
    tmp = path(name) + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path(name))


def load_config():
    cfg = dict(DEFAULTS)
    cfg.update(load_json("config.json", {}))
    if cfg["category"] not in ("linear", "spot"):
        raise BybitError('"category" deve ser "linear" (futuros perpetuos USDT) ou "spot"')
    if cfg["category"] == "spot":
        cfg["allow_short"] = False
    if cfg["fee_pct"] is None:
        cfg["fee_pct"] = 0.055 if cfg["category"] == "linear" else 0.1
    return cfg


def utc(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def today_utc():
    return datetime.fromtimestamp(_now(), timezone.utc).strftime("%Y-%m-%d")


# ---------------------------------------------------------------- http / auth

def sign(secret, msg):
    return hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()


def http(method, url, body=None, headers=None, timeout=20):
    req = urllib.request.Request(url, data=body.encode() if body is not None else None, method=method,
                                 headers={"User-Agent": UA, **(headers or {})})
    try:
        with _urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        if e.code == 403 and "country" in raw:
            raise BybitError("A Bybit bloqueia o pais de onde este computador acessa (HTTP 403). "
                             "Rode no seu proprio computador, nao num servidor dos EUA.")
        if e.code == 401:
            raise BybitError("HTTP 401: a Bybit recusou a chave. Confira: (1) chave e segredo copiados inteiros, "
                             "sem trocar um pelo outro; (2) a chave e da mesma rede (chave da testnet so funciona "
                             "na testnet); (3) a chave nao foi apagada; (4) o relogio do computador esta certo.")
        raise BybitError("HTTP %d: %s" % (e.code, raw[:300]))
    except urllib.error.URLError as e:
        raise BybitError("Sem conexao com a Bybit: %s" % e.reason)
    j = json.loads(raw)
    if j.get("retCode", 0) != 0:
        raise BybitError("Bybit retCode %s: %s" % (j.get("retCode"), j.get("retMsg")), j.get("retCode"))
    return j.get("result", j)


class Client:
    def __init__(self, base, key=None, secret=None, recv_window=5000):
        self.base, self.key, self.secret, self.recv_window = base, key, secret, recv_window

    def public(self, route, params):
        return http("GET", self.base + route + "?" + urllib.parse.urlencode(params))

    def private(self, method, route, params):
        if not (self.key and self.secret):
            raise BybitError("Faltam BYBIT_API_KEY e BYBIT_API_SECRET nas variaveis de ambiente "
                             "(digite-as no terminal, nunca no chat).")
        ts = str(int(_now() * 1000))
        if method == "GET":
            payload = urllib.parse.urlencode(params)
            url, body = self.base + route + ("?" + payload if payload else ""), None
        else:
            payload = json.dumps(params, separators=(",", ":"))
            url, body = self.base + route, payload
        headers = {
            "X-BAPI-API-KEY": self.key,
            "X-BAPI-TIMESTAMP": ts,
            "X-BAPI-RECV-WINDOW": str(self.recv_window),
            "X-BAPI-SIGN": sign(self.secret, ts + self.key + str(self.recv_window) + payload),
            "Content-Type": "application/json",
        }
        return http(method, url, body, headers)


def venue(cfg):
    """Testnet unless the config AND the environment both say mainnet."""
    if cfg.get("mainnet"):
        if os.environ.get("BYBIT_MAINNET") != "1":
            raise BybitError('O config diz "mainnet": true, mas BYBIT_MAINNET=1 nao esta definido. '
                             "As duas travas sao necessarias para usar dinheiro real.")
        return MAINNET
    return TESTNET


def trading_client(cfg):
    return Client(venue(cfg), (os.environ.get("BYBIT_API_KEY") or "").strip(),
                  (os.environ.get("BYBIT_API_SECRET") or "").strip())


# ---------------------------------------------------------------- market data

def parse_rows(rows):
    rows = sorted({int(r[0]): r for r in rows}.values(), key=lambda r: int(r[0]))
    return [{"t": int(r[0]), "o": float(r[1]), "h": float(r[2]), "l": float(r[3]),
             "c": float(r[4]), "v": float(r[5])} for r in rows]


def fetch_klines(client, category, symbol, interval, bars):
    rows, end = [], None
    while len(rows) < bars:
        limit = min(1000, bars - len(rows))
        p = {"category": category, "symbol": symbol, "interval": interval, "limit": limit}
        if end is not None:
            p["end"] = end
        page = client.public("/v5/market/kline", p)["list"]
        if not page:
            break
        rows.extend(page)
        end = min(int(r[0]) for r in page) - 1
        if len(page) < limit:
            break
    return parse_rows(rows)[-bars:]


def closed_only(bars, interval):
    ms = INTERVAL_MIN[interval] * 60000
    now = _now() * 1000
    return [b for b in bars if b["t"] + ms <= now]


def load_offline(file):
    with open(file) as f:
        j = json.load(f)
    if isinstance(j, dict):
        j = j.get("result", j).get("list", j.get("bars", []))
    if j and isinstance(j[0], dict):
        return sorted(j, key=lambda b: b["t"])
    return parse_rows(j)


def get_bars(args, cfg, symbol, base, bars):
    if getattr(args, "offline", None):
        return load_offline(args.offline)
    raw = fetch_klines(Client(base), cfg["category"], symbol, args.interval or cfg["interval"], bars)
    return closed_only(raw, args.interval or cfg["interval"])


def instrument(client, category, symbol):
    lst = client.public("/v5/market/instruments-info", {"category": category, "symbol": symbol})["list"]
    if not lst:
        raise BybitError("Par %s nao existe na categoria %s" % (symbol, category))
    i = lst[0]
    lot, pf = i["lotSizeFilter"], i["priceFilter"]
    return {
        "tick": pf["tickSize"],
        "step": lot.get("qtyStep") or lot.get("basePrecision"),
        "min_qty": lot.get("minOrderQty", "0"),
        "max_qty": lot.get("maxOrderQty") or lot.get("maxMktOrderQty") or "1e18",
        "min_notional": lot.get("minNotionalValue") or lot.get("minOrderAmt") or "0",
        "max_leverage": (i.get("leverageFilter") or {}).get("maxLeverage", "1"),
    }


# ---------------------------------------------------------------- indicators

def ema(xs, n):
    out = [None] * len(xs)
    if len(xs) < n:
        return out
    k, s = 2.0 / (n + 1), sum(xs[:n]) / n
    out[n - 1] = s
    for i in range(n, len(xs)):
        s = xs[i] * k + s * (1 - k)
        out[i] = s
    return out


def rsi(closes, n=14):
    out = [None] * len(closes)
    if len(closes) <= n:
        return out
    g = sum(max(closes[i] - closes[i - 1], 0) for i in range(1, n + 1)) / n
    l = sum(max(closes[i - 1] - closes[i], 0) for i in range(1, n + 1)) / n
    out[n] = 100.0 if l == 0 else 100 - 100 / (1 + g / l)
    for i in range(n + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        g = (g * (n - 1) + max(d, 0)) / n
        l = (l * (n - 1) + max(-d, 0)) / n
        out[i] = 100.0 if l == 0 else 100 - 100 / (1 + g / l)
    return out


def atr(bars, n=14):
    out = [None] * len(bars)
    if len(bars) < n:
        return out
    tr = [bars[0]["h"] - bars[0]["l"]] + [
        max(b["h"] - b["l"], abs(b["h"] - p["c"]), abs(b["l"] - p["c"])) for p, b in zip(bars, bars[1:])]
    a = sum(tr[:n]) / n
    out[n - 1] = a
    for i in range(n, len(bars)):
        a = (a * (n - 1) + tr[i]) / n
        out[i] = a
    return out


def indicators(bars):
    c = [b["c"] for b in bars]
    return {"ema9": ema(c, 9), "ema21": ema(c, 21), "ema200": ema(c, 200), "rsi": rsi(c), "atr": atr(bars)}


# ---------------------------------------------------------------- strategies

def signal(bars, ind, i, name, allow_short=True):
    """Signal on the CLOSED bar i, or None. Returns side, stop distance, R multiple, why."""
    if i < WARMUP or ind["ema200"][i] is None or ind["atr"][i] is None:
        return None
    c, a, e200 = bars[i]["c"], ind["atr"][i], ind["ema200"][i]

    def mk(side, k, rr, why):
        return {"side": side, "stop_dist": k * a, "rr": rr, "why": why}

    if name == "trend":
        f, s = ind["ema9"], ind["ema21"]
        if f[i - 1] <= s[i - 1] and f[i] > s[i] and c > e200:
            return mk("Buy", 2.0, 2.0, "EMA9 cruzou acima da EMA21, preco acima da EMA200")
        if allow_short and f[i - 1] >= s[i - 1] and f[i] < s[i] and c < e200:
            return mk("Sell", 2.0, 2.0, "EMA9 cruzou abaixo da EMA21, preco abaixo da EMA200")
    elif name == "breakout":
        prev = bars[i - 20:i]
        hh, ll = max(b["h"] for b in prev), min(b["l"] for b in prev)
        vol_ok = bars[i]["v"] > 1.5 * sum(b["v"] for b in prev) / 20
        if c > hh and c > e200 and vol_ok:
            return mk("Buy", 1.5, 2.0, "fechou acima da maxima de 20 velas (%.6g) com volume forte" % hh)
        if allow_short and c < ll and c < e200 and vol_ok:
            return mk("Sell", 1.5, 2.0, "fechou abaixo da minima de 20 velas (%.6g) com volume forte" % ll)
    elif name == "meanrev":
        r = ind["rsi"]
        if r[i - 1] is not None and r[i - 1] < 30 <= r[i] and c > e200:
            return mk("Buy", 1.5, 1.5, "RSI saiu da sobrevenda (%.1f -> %.1f) em tendencia de alta" % (r[i - 1], r[i]))
        if allow_short and r[i - 1] is not None and r[i - 1] > 70 >= r[i] and c < e200:
            return mk("Sell", 1.5, 1.5, "RSI saiu da sobrecompra (%.1f -> %.1f) em tendencia de baixa" % (r[i - 1], r[i]))
    else:
        raise BybitError("estrategia desconhecida: %s (use %s)" % (name, ", ".join(STRATEGIES)))
    return None


# ---------------------------------------------------------------- backtest

def backtest(bars, name, allow_short=True, fee_pct=0.055, slip_pct=0.02, risk_pct=1.0, start=0):
    """Signal at a bar's close, entry at the next bar's open. Stop and target are
    a bracket; when one bar touches both, the stop counts (the pessimistic case).
    Fees and slippage on both sides are charged in R."""
    ind, fee, slip = indicators(bars), fee_pct / 100, slip_pct / 100
    trades, i = [], max(WARMUP, start)
    while i < len(bars) - 1:
        s = signal(bars, ind, i, name, allow_short)
        if not s:
            i += 1
            continue
        buy, d = s["side"] == "Buy", s["stop_dist"]
        entry = bars[i + 1]["o"] * (1 + slip if buy else 1 - slip)
        stop = entry - d if buy else entry + d
        target = entry + d * s["rr"] if buy else entry - d * s["rr"]
        exit_px, why, j = None, None, i + 1
        while j < len(bars):
            b = bars[j]
            if buy and b["l"] <= stop:
                exit_px, why = min(stop, b["o"]), "stop"
            elif not buy and b["h"] >= stop:
                exit_px, why = max(stop, b["o"]), "stop"
            elif buy and b["h"] >= target or not buy and b["l"] <= target:
                exit_px, why = target, "alvo"
            if exit_px is not None:
                break
            j += 1
        if exit_px is None:
            break
        exit_px *= (1 - slip) if buy else (1 + slip)
        gross = (exit_px - entry) / d if buy else (entry - exit_px) / d
        r = gross - (entry + exit_px) * fee / d
        trades.append({"t": bars[i]["t"], "side": s["side"], "entry": entry, "exit": exit_px, "why": why, "r": r})
        i = j
    return stats(trades, risk_pct)


def stats(trades, risk_pct):
    rs = [t["r"] for t in trades]
    wins = [r for r in rs if r > 0]
    loss = -sum(r for r in rs if r <= 0)
    eq = peak = 1.0
    dd = 0.0
    for r in rs:
        eq *= 1 + r * risk_pct / 100
        peak = max(peak, eq)
        dd = max(dd, 1 - eq / peak)
    return {
        "trades": len(rs),
        "win_rate": 100.0 * len(wins) / len(rs) if rs else 0.0,
        "avg_r": sum(rs) / len(rs) if rs else 0.0,
        "total_r": sum(rs),
        "profit_factor": (sum(wins) / loss) if loss > 0 else (float("inf") if wins else 0.0),
        "return_pct": (eq - 1) * 100,
        "max_dd_pct": dd * 100,
        "list": trades,
    }


def walk_forward(bars, name, allow_short, fee_pct, slip_pct, risk_pct, split=0.7):
    """In-sample on the first 70 %, out-of-sample on the last 30 % (indicators warm up before the cut)."""
    cut = int(len(bars) * split)
    ins = backtest(bars[:cut], name, allow_short, fee_pct, slip_pct, risk_pct)
    out = backtest(bars, name, allow_short, fee_pct, slip_pct, risk_pct, start=cut)
    return ins, out, verdict(ins, out)


def verdict(ins, out):
    if out["trades"] < 10 or ins["trades"] < 10:
        return "INCONCLUSIVO", "poucas operacoes para concluir alguma coisa"
    if ins["avg_r"] > 0 and out["avg_r"] > 0 and out["profit_factor"] >= 1.1:
        return "APROVADA", "lucrativa depois das taxas nos dois periodos (nao e garantia de futuro)"
    return "REPROVADA", "nao se sustentou depois das taxas: nao opere esta combinacao"


# ---------------------------------------------------------------- plan, size, risk

def rnd(x, step, up=False):
    s = Decimal(str(step))
    return (Decimal(str(x)) / s).quantize(Decimal(1), rounding=ROUND_UP if up else ROUND_DOWN) * s


def make_plan(bars, name, cfg, symbol, interval):
    ind = indicators(bars)
    i = len(bars) - 1
    s = signal(bars, ind, i, name, cfg["allow_short"])
    if not s:
        return None
    buy, entry, d = s["side"] == "Buy", bars[i]["c"], s["stop_dist"]
    return {
        "symbol": symbol, "category": cfg["category"], "interval": interval, "strategy": name,
        "side": s["side"], "entry": entry,
        "stop": entry - d if buy else entry + d,
        "target": entry + d * s["rr"] if buy else entry - d * s["rr"],
        "rr": s["rr"], "why": s["why"], "bar_time": bars[i]["t"], "created": _now(),
    }


def fingerprint(*parts):
    return "bt-" + hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:20]


def journal_today(journal):
    day = today_utc()
    return [e for e in journal if e.get("action") == "placed" and e.get("day") == day]


def size_order(plan, inst, equity, available, cfg, journal):
    """One bracket order from the plan, sized so the loss at the stop (fees included)
    is risk_pct of equity, then every risk rule. Status PASS or BLOCK with reasons."""
    buy, cat = plan["side"] == "Buy", plan["category"]
    reasons = []
    tick, step = inst["tick"], inst["step"]
    entry = rnd(plan["entry"], tick)
    stop = rnd(plan["stop"], tick, up=not buy)          # away from the entry
    target = rnd(plan["target"], tick, up=not buy)      # toward the entry
    fee = cfg["fee_pct"] / 100
    e, st, tg = float(entry), float(stop), float(target)
    dist = abs(e - st)
    if dist <= 0 or (buy and not (st < e < tg)) or (not buy and not (tg < e < st)):
        reasons.append("stop/alvo invalidos para o lado da operacao")
        dist = dist or 1e-12
    lev = 1 if cat == "spot" else min(int(cfg["max_leverage"]), int(float(inst["max_leverage"])))
    risk_usd = equity * cfg["risk_pct"] / 100
    per_unit = dist + (e + st) * fee
    caps = {
        "perda maxima por operacao": risk_usd / per_unit,
        "tamanho maximo da posicao": equity * cfg["max_position_pct"] / 100 * lev / e,
        "saldo disponivel": available * 0.95 * lev / e,
        "quantidade maxima do par": float(inst["max_qty"]),
    }
    decided = min(caps, key=caps.get)
    qty = rnd(max(caps[decided], 0), step)
    q = float(qty)
    loss = q * per_unit
    rr = abs(tg - e) / dist

    if plan["symbol"] in cfg["blocked"]:
        reasons.append("%s esta na lista de bloqueados" % plan["symbol"])
    if not buy and (cat == "spot" or not cfg["allow_short"]):
        reasons.append("venda a descoberto (short) nao permitida" + (" no spot" if cat == "spot" else ""))
    if int(cfg["max_leverage"]) > HARD_MAX_LEVERAGE:
        reasons.append("alavancagem acima de %dx nao e aceita por esta ferramenta" % HARD_MAX_LEVERAGE)
    if rr + 1e-9 < cfg["min_rr"]:
        reasons.append("retorno/risco %.2f abaixo do minimo %.2f" % (rr, cfg["min_rr"]))
    if q < float(inst["min_qty"]) or q * e < float(inst["min_notional"]):
        reasons.append("conta pequena demais para este stop: a quantidade (%s) fica abaixo do minimo do par" % qty)
    today = journal_today(journal)
    if len(today) >= cfg["max_trades_per_day"]:
        reasons.append("limite de %d operacoes por dia atingido" % cfg["max_trades_per_day"])
    used = sum(x.get("risk_usd", 0) for x in today)
    limit = equity * cfg["daily_loss_limit_pct"] / 100
    if used + loss > limit + 1e-9:
        reasons.append("risco do dia estouraria o limite: %.2f ja usado + %.2f > %.2f USDT" % (used, loss, limit))
    age = _now() - (plan["bar_time"] / 1000 + INTERVAL_MIN[plan["interval"]] * 60)
    if age > INTERVAL_MIN[plan["interval"]] * 60 * cfg["max_signal_age_bars"]:
        reasons.append("sinal velho (vela fechou ha %d min): rode signal de novo" % (age // 60))

    fp = fingerprint(cat, plan["symbol"], plan["side"], qty, stop, target, plan["bar_time"])
    body = {"category": cat, "symbol": plan["symbol"], "side": plan["side"], "qty": str(qty),
            "takeProfit": str(target), "stopLoss": str(stop), "orderLinkId": fp}
    if cat == "linear":
        body.update({"orderType": "Market", "tpslMode": "Full", "tpTriggerBy": "LastPrice",
                     "slTriggerBy": "LastPrice", "positionIdx": 0})
    else:
        body.update({"orderType": "Limit", "price": str(entry), "timeInForce": "GTC"})
    return {
        "status": "BLOCK" if reasons else "PASS", "reasons": reasons, "fingerprint": fp,
        "symbol": plan["symbol"], "category": cat, "side": plan["side"], "strategy": plan["strategy"],
        "why": plan["why"], "qty": str(qty), "entry": str(entry), "stop": str(stop), "target": str(target),
        "rr": round(rr, 2), "risk_usd": round(loss, 2), "reward_usd": round(q * (abs(tg - e) - (e + tg) * fee), 2),
        "notional_usd": round(q * e, 2), "leverage": lev, "decided_by": decided,
        "equity": round(equity, 2), "created": _now(), "body": body,
    }


def ticket(o, i):
    side = "COMPRA (long)" if o["side"] == "Buy" else "VENDA (short)"
    lines = ["#%d  %s  %s %s %s  [%s]" % (i, o["status"], side, o["qty"], o["symbol"], o["category"]),
             "    estrategia: %s (%s)" % (o["strategy"], o["why"]),
             "    entrada ~%s   stop %s   alvo %s   retorno/risco %.2f" % (o["entry"], o["stop"], o["target"], o["rr"]),
             "    perda no stop ~%.2f USDT   ganho no alvo ~%.2f USDT (taxas incluidas)" % (o["risk_usd"], o["reward_usd"]),
             "    posicao %.2f USDT, alavancagem %dx, tamanho decidido por: %s" % (o["notional_usd"], o["leverage"], o["decided_by"])]
    for r in o["reasons"]:
        lines.append("    BLOQUEADA: " + r)
    return "\n".join(lines)


def is_yes(reply):
    return (reply or "").strip().lower().strip("!.? ").replace(",", "") in YES


# ---------------------------------------------------------------- account

def wallet(client):
    acc = client.private("GET", "/v5/account/wallet-balance", {"accountType": "UNIFIED"})["list"][0]
    return float(acc.get("totalEquity") or 0), float(acc.get("totalAvailableBalance") or 0), acc


def open_position(client, symbol):
    for p in client.private("GET", "/v5/position/list", {"category": "linear", "symbol": symbol})["list"]:
        if float(p.get("size") or 0) > 0:
            return p
    return None


def place(client, order, reply, cfg, journal):
    if order["status"] != "PASS":
        raise BybitError("Ordem BLOQUEADA pela checagem de risco: " + "; ".join(order["reasons"]))
    if not is_yes(reply):
        raise BybitError('Sem um "sim" claro do usuario para esta ordem. Nada foi enviado.')
    if _now() - order["created"] > cfg["order_ttl_minutes"] * 60:
        raise BybitError("Ordem com mais de %d min: o preco mudou. Rode signal e size de novo." % cfg["order_ttl_minutes"])
    if any(e.get("fingerprint") == order["fingerprint"] and e.get("action") == "placed" for e in journal):
        raise BybitError("Esta ordem ja foi enviada antes.")
    if order["category"] == "linear":
        if open_position(client, order["symbol"]):
            raise BybitError("Ja existe posicao aberta em %s. Feche antes de abrir outra." % order["symbol"])
        try:
            client.private("POST", "/v5/position/set-leverage", {
                "category": "linear", "symbol": order["symbol"],
                "buyLeverage": str(order["leverage"]), "sellLeverage": str(order["leverage"])})
        except BybitError as e:
            if e.code != 110043:          # 110043 = leverage not modified
                raise
    res = client.private("POST", "/v5/order/create", order["body"])
    entry = {"action": "placed", "day": today_utc(), "time": utc(_now()), "fingerprint": order["fingerprint"],
             "symbol": order["symbol"], "side": order["side"], "qty": order["qty"], "risk_usd": order["risk_usd"],
             "order_id": res.get("orderId"), "reply": reply, "venue": client.base}
    journal.append(entry)
    return entry


def close_body(client, cfg, symbol):
    if cfg["category"] == "linear":
        p = open_position(client, symbol)
        if not p:
            return None
        return {"category": "linear", "symbol": symbol, "side": "Sell" if p["side"] == "Buy" else "Buy",
                "orderType": "Market", "qty": p["size"], "reduceOnly": True, "positionIdx": 0}
    coin = symbol[:-4] if symbol.endswith("USDT") else symbol
    _, _, acc = wallet(client)
    bal = next((c for c in acc.get("coin", []) if c.get("coin") == coin), None)
    inst = instrument(client, "spot", symbol)
    qty = rnd(float(bal["walletBalance"]), inst["step"]) if bal else Decimal(0)
    if qty <= 0:
        return None
    return {"category": "spot", "symbol": symbol, "side": "Sell", "orderType": "Market",
            "qty": str(qty), "marketUnit": "baseCoin"}


# ---------------------------------------------------------------- CLI

def fmt_stats(s):
    pf = "inf" if s["profit_factor"] == float("inf") else "%.2f" % s["profit_factor"]
    return "%3d ops  acerto %5.1f%%  media %+.2fR  PF %s  retorno %+.1f%%  queda max %.1f%%" % (
        s["trades"], s["win_rate"], s["avg_r"], pf, s["return_pct"], s["max_dd_pct"])


def cmd_backtest(args, cfg):
    symbols = args.symbols.split(",") if args.symbols else cfg["watchlist"]
    names = STRATEGIES if args.strategy == "all" else (args.strategy,)
    interval = args.interval or cfg["interval"]
    results = []
    for sym in symbols:
        bars = get_bars(args, cfg, sym, MAINNET, args.bars)
        print("\n%s  %s velas de %s min (%s a %s), taxa %.3f%% + deslizamento %.3f%% por lado" % (
            sym, len(bars), interval, utc(bars[0]["t"] / 1000) if bars else "-",
            utc(bars[-1]["t"] / 1000) if bars else "-", cfg["fee_pct"], cfg["slippage_pct"]))
        for n in names:
            ins, out, (v, why) = walk_forward(bars, n, cfg["allow_short"], cfg["fee_pct"], cfg["slippage_pct"], cfg["risk_pct"])
            print("  %-9s treino: %s" % (n, fmt_stats(ins)))
            print("  %-9s teste : %s  -> %s (%s)" % ("", fmt_stats(out), v, why))
            results.append({"symbol": sym, "interval": interval, "strategy": n, "verdict": v,
                            "train": {k: x for k, x in ins.items() if k != "list"},
                            "test": {k: x for k, x in out.items() if k != "list"}})
    if args.write:
        save_json("backtest.json", {"created": utc(_now()), "results": results})
        print("\ngravado em %s" % path("backtest.json"))
    approved = [r for r in results if r["verdict"] == "APROVADA"]
    print("\nAprovadas: " + (", ".join("%s/%s" % (r["symbol"], r["strategy"]) for r in approved) or "nenhuma"))
    print("Backtest e historico, nao previsao. Use so as aprovadas, e primeiro na testnet.")


def strategies_for(cfg, sym):
    return cfg["strategies"].get(sym) or list(STRATEGIES)


def cmd_scan(args, cfg):
    base = venue(cfg)
    interval = args.interval or cfg["interval"]
    for sym in (args.symbols.split(",") if args.symbols else cfg["watchlist"]):
        bars = get_bars(args, cfg, sym, base, 400)
        for n in strategies_for(cfg, sym):
            p = make_plan(bars, n, cfg, sym, interval)
            if p:
                print("%-10s %-9s %s @ %.6g  stop %.6g  alvo %.6g  (%s)" % (
                    sym, n, "LONG " if p["side"] == "Buy" else "SHORT", p["entry"], p["stop"], p["target"], p["why"]))
    print("(so aparecem pares com sinal na ultima vela fechada; nada = esperar)")


def cmd_signal(args, cfg):
    interval = args.interval or cfg["interval"]
    bars = get_bars(args, cfg, args.symbol, venue(cfg), 400)
    names = strategies_for(cfg, args.symbol) if args.strategy == "all" else [args.strategy]
    for n in names:
        p = make_plan(bars, n, cfg, args.symbol, interval)
        if p:
            print("SINAL %s %s via %s: entrada ~%.6g stop %.6g alvo %.6g (%s)" % (
                "LONG" if p["side"] == "Buy" else "SHORT", args.symbol, n, p["entry"], p["stop"], p["target"], p["why"]))
            if args.write:
                save_json("plan.json", p)
                print("gravado em %s -> proximo passo: size" % path("plan.json"))
            return 0
    print("Sem sinal em %s na vela fechada de %s. Esperar e nao forcar." % (args.symbol, utc(bars[-1]["t"] / 1000)))
    return 1


def approved(plan):
    return any(r["verdict"] == "APROVADA" and r["symbol"] == plan["symbol"] and r["strategy"] == plan["strategy"]
               and r["interval"] == plan["interval"] for r in load_json("backtest.json", {"results": []})["results"])


def cmd_size(args, cfg):
    plan = load_json("plan.json", None)
    if not plan:
        raise BybitError("Sem plano: rode signal --write primeiro.")
    client = trading_client(cfg)
    inst = json.load(open(args.instrument)) if args.instrument else instrument(client, plan["category"], plan["symbol"])
    if args.equity is not None:
        equity = available = args.equity
    else:
        equity, available, _ = wallet(client)
    o = size_order(plan, inst, equity, available, cfg, load_json("journal.json", []))
    if client.base == MAINNET and not approved(plan):
        o["reasons"].append("na conta real so entram estrategias APROVADAS no backtest deste par e tempo grafico "
                            "(rode backtest --write)")
        o["status"] = "BLOCK"
    save_json("orders.json", {"orders": [o]})
    print(ticket(o, 1))
    return 0 if o["status"] == "PASS" else 2


def cmd_show(args, cfg):
    orders = load_json("orders.json", {"orders": []})["orders"]
    for i, o in enumerate(orders, 1):
        print(ticket(o, i))
    if not orders:
        print("Nenhuma ordem. Fluxo: signal --write -> size -> show -> place")


def cmd_place(args, cfg):
    orders = load_json("orders.json", {"orders": []})["orders"]
    if not 1 <= args.index <= len(orders):
        raise BybitError("Nao existe a ordem #%d" % args.index)
    journal = load_json("journal.json", [])
    client = trading_client(cfg)
    e = place(client, orders[args.index - 1], args.reply, cfg, journal)
    save_json("journal.json", journal)
    print("ENVIADA para %s: %s %s %s, orderId %s" % (
        "MAINNET (dinheiro real)" if client.base == MAINNET else "TESTNET", e["side"], e["qty"], e["symbol"], e["order_id"]))


def cmd_close(args, cfg):
    client = trading_client(cfg)
    body = close_body(client, cfg, args.symbol)
    if not body:
        print("Nada aberto em %s." % args.symbol)
        return 1
    if not is_yes(args.reply):
        print('Para fechar: %s %s %s a mercado. Precisa de --reply "sim".' % (body["side"], body["qty"], args.symbol))
        return 2
    res = client.private("POST", "/v5/order/create", body)
    journal = load_json("journal.json", [])
    journal.append({"action": "closed", "day": today_utc(), "time": utc(_now()), "symbol": args.symbol,
                    "qty": body["qty"], "order_id": res.get("orderId"), "reply": args.reply})
    save_json("journal.json", journal)
    print("Fechamento enviado: %s %s %s, orderId %s" % (body["side"], body["qty"], args.symbol, res.get("orderId")))


def cmd_balance(args, cfg):
    client = trading_client(cfg)
    eq, av, acc = wallet(client)
    print("%s  patrimonio %.2f USD  disponivel %.2f USD" % ("MAINNET" if client.base == MAINNET else "TESTNET", eq, av))
    for c in acc.get("coin", []):
        if float(c.get("walletBalance") or 0):
            print("  %-6s %s" % (c["coin"], c["walletBalance"]))


def cmd_positions(args, cfg):
    lst = trading_client(cfg).private("GET", "/v5/position/list", {"category": "linear", "settleCoin": "USDT"})["list"]
    for p in lst:
        if float(p.get("size") or 0):
            print("%-10s %-4s %s @ %s  stop %s  alvo %s  PnL %s" % (
                p["symbol"], p["side"], p["size"], p["avgPrice"], p.get("stopLoss") or "-",
                p.get("takeProfit") or "-", p.get("unrealisedPnl")))
    if not any(float(p.get("size") or 0) for p in lst):
        print("Nenhuma posicao aberta em futuros.")


def cmd_journal(args, cfg):
    for e in load_json("journal.json", []):
        print(json.dumps(e, ensure_ascii=False))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("backtest")
    b.add_argument("--symbols")
    b.add_argument("--strategy", default="all", choices=("all",) + STRATEGIES)
    b.add_argument("--bars", type=int, default=5000)
    b.add_argument("--write", action="store_true")
    s = sub.add_parser("scan")
    s.add_argument("--symbols")
    g = sub.add_parser("signal")
    g.add_argument("symbol")
    g.add_argument("--strategy", default="all", choices=("all",) + STRATEGIES)
    g.add_argument("--write", action="store_true")
    for p in (b, s, g):
        p.add_argument("--interval", choices=sorted(INTERVAL_MIN))
        p.add_argument("--offline", help="arquivo JSON de velas (formato da Bybit) em vez da internet")
    z = sub.add_parser("size")
    z.add_argument("--equity", type=float, help="patrimonio em USDT (senao le o saldo da conta)")
    z.add_argument("--instrument", help="JSON com tick/step/min_qty... (senao le da Bybit)")
    sub.add_parser("show")
    pl = sub.add_parser("place")
    pl.add_argument("--index", type=int, default=1)
    pl.add_argument("--reply", required=True, help='a resposta do usuario, palavra por palavra ("sim")')
    c = sub.add_parser("close")
    c.add_argument("symbol")
    c.add_argument("--reply", default="")
    sub.add_parser("balance")
    sub.add_parser("positions")
    sub.add_parser("journal")
    args = ap.parse_args(argv)
    try:
        cfg = load_config()
        return globals()["cmd_" + args.cmd](args, cfg) or 0
    except BybitError as e:
        print("ERRO: %s" % e, file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
