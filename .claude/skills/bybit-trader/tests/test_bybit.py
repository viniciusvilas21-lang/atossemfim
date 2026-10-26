import contextlib
import io
import json
import os
import random
import sys
import tempfile
import unittest
import urllib.parse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bybit  # noqa: E402

NOW = 1_800_000_000.0
HOUR_MS = 3_600_000


def synthetic(n=3000, seed=7, start_px=100.0):
    """Hourly bars: a random walk that switches between up, down and flat regimes."""
    rnd = random.Random(seed)
    t0 = int(NOW * 1000) - (n + 1) * HOUR_MS
    t0 -= t0 % HOUR_MS
    px, bars, drift = start_px, [], 0.0
    for i in range(n):
        if i % 300 == 0:
            drift = rnd.choice([0.0015, -0.0015, 0.0])
        o = px
        c = o * (1 + drift + rnd.gauss(0, 0.008))
        h = max(o, c) * (1 + abs(rnd.gauss(0, 0.003)))
        l = min(o, c) * (1 - abs(rnd.gauss(0, 0.003)))
        bars.append({"t": t0 + i * HOUR_MS, "o": o, "h": h, "l": l, "c": c, "v": rnd.uniform(50, 150)})
        px = c
    return bars


INST = {"tick": "0.01", "step": "0.001", "min_qty": "0.001", "max_qty": "1000",
        "min_notional": "5", "max_leverage": "50"}


def cfg(**kw):
    c = dict(bybit.DEFAULTS)
    c["fee_pct"] = 0.055
    c.update(kw)
    return c


def plan(side="Buy", entry=100.0, stop=98.0, target=104.0, bar_time=None, category="linear"):
    return {"symbol": "BTCUSDT", "category": category, "interval": "60", "strategy": "trend",
            "side": side, "entry": entry, "stop": stop, "target": target, "rr": 2.0, "why": "teste",
            "bar_time": bar_time if bar_time is not None else int(NOW * 1000) - 2 * HOUR_MS + 60000,
            "created": NOW}


class Base(unittest.TestCase):
    def setUp(self):
        self.saved = (bybit._now, bybit._urlopen)
        bybit._now = lambda: NOW
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["BYBIT_TRADER_DIR"] = self.tmp.name
        os.environ.pop("BYBIT_MAINNET", None)

    def tearDown(self):
        bybit._now, bybit._urlopen = self.saved
        self.tmp.cleanup()
        os.environ.pop("BYBIT_TRADER_DIR", None)


class Indicators(Base):
    def test_ema_of_constant_is_constant(self):
        self.assertEqual(bybit.ema([5.0] * 30, 9)[-1], 5.0)
        self.assertIsNone(bybit.ema([5.0] * 30, 9)[7])

    def test_rsi_extremes(self):
        self.assertEqual(bybit.rsi([float(i) for i in range(40)])[-1], 100.0)
        self.assertLess(bybit.rsi([float(40 - i) for i in range(40)])[-1], 1e-9)

    def test_atr_constant_range(self):
        bars = [{"o": 10, "h": 11, "l": 9, "c": 10, "v": 1} for _ in range(30)]
        self.assertAlmostEqual(bybit.atr(bars)[-1], 2.0)


class Signing(Base):
    def capture(self, result):
        seen = {}

        class Resp(io.BytesIO):
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

        def fake(req, timeout=None):
            seen["req"] = req
            return Resp(json.dumps({"retCode": 0, "result": result}).encode())
        bybit._urlopen = fake
        return seen

    def test_get_and_post_signatures(self):
        c = bybit.Client("https://x", "KEY", "SECRET")
        seen = self.capture({"list": []})
        c.private("GET", "/v5/position/list", {"category": "linear", "symbol": "BTCUSDT"})
        h = {k.lower(): v for k, v in seen["req"].header_items()}
        qs = urllib.parse.urlparse(seen["req"].full_url).query
        self.assertEqual(qs, "category=linear&symbol=BTCUSDT")
        self.assertEqual(h["x-bapi-sign"], bybit.sign("SECRET", h["x-bapi-timestamp"] + "KEY5000" + qs))
        self.assertEqual(h["x-bapi-timestamp"], str(int(NOW * 1000)))

        c.private("POST", "/v5/order/create", {"symbol": "BTCUSDT", "qty": "0.1"})
        h = {k.lower(): v for k, v in seen["req"].header_items()}
        body = seen["req"].data.decode()
        self.assertEqual(body, '{"symbol":"BTCUSDT","qty":"0.1"}')
        self.assertEqual(h["x-bapi-sign"], bybit.sign("SECRET", h["x-bapi-timestamp"] + "KEY5000" + body))

    def test_clock_offset_from_server(self):
        c = bybit.Client("https://x", "KEY", "SECRET")
        self.capture({"timeSecond": "0", "timeNano": str(int((NOW + 7.5) * 1e9))})
        self.assertEqual(c.server_offset_ms(), 7500)
        seen = self.capture({"list": []})
        c.private("GET", "/v5/position/list", {"category": "linear"})
        h = {k.lower(): v for k, v in seen["req"].header_items()}
        self.assertEqual(h["x-bapi-timestamp"], str(int(NOW * 1000) + 7500))

    def test_no_keys_is_refused(self):
        with self.assertRaises(bybit.BybitError):
            bybit.Client("https://x").private("GET", "/v5/account/wallet-balance", {})

    def test_keys_from_file_per_network(self):
        os.environ.pop("BYBIT_API_KEY", None)
        os.environ.pop("BYBIT_API_SECRET", None)
        self.assertEqual(bybit.load_keys(bybit.TESTNET)[:2], ("", ""))
        bybit.save_json("keys-testnet.json", {"key": "TK", "secret": "TS"})
        self.assertEqual(bybit.load_keys(bybit.TESTNET)[:2], ("TK", "TS"))
        self.assertEqual(bybit.load_keys(bybit.MAINNET)[:2], ("", ""))   # testnet keys never reach mainnet
        os.environ["BYBIT_API_KEY"], os.environ["BYBIT_API_SECRET"] = "EK", "ES"
        try:
            self.assertEqual(bybit.load_keys(bybit.TESTNET)[:2], ("TK", "TS"))   # the file wins
            self.assertEqual(bybit.load_keys(bybit.MAINNET)[:2], ("EK", "ES"))
        finally:
            os.environ.pop("BYBIT_API_KEY")
            os.environ.pop("BYBIT_API_SECRET")

    def test_mainnet_needs_both_switches(self):
        self.assertEqual(bybit.venue(cfg()), bybit.TESTNET)
        with self.assertRaises(bybit.BybitError):
            bybit.venue(cfg(mainnet=True))
        os.environ["BYBIT_MAINNET"] = "1"
        self.assertEqual(bybit.venue(cfg(mainnet=True)), bybit.MAINNET)
        self.assertEqual(bybit.venue(cfg()), bybit.TESTNET)


class Data(Base):
    def test_pagination_and_closed_bars(self):
        rows = [[str(t), "1", "2", "0.5", "1.5", "10", "15"] for t in range(0, 2500 * HOUR_MS, HOUR_MS)]

        class Fake:
            calls = []

            def public(self, route, p):
                self.calls.append(p)
                end = p.get("end", rows[-1][0] and int(rows[-1][0]))
                page = [r for r in rows if int(r[0]) <= end][-p["limit"]:]
                return {"list": list(reversed(page))}     # Bybit sends newest first
        f = Fake()
        bars = bybit.fetch_klines(f, "linear", "BTCUSDT", "60", 2200)
        self.assertEqual(len(bars), 2200)
        self.assertEqual(len(f.calls), 3)
        self.assertEqual(bars[-1]["t"], int(rows[-1][0]))
        self.assertTrue(all(b["t"] < a["t"] for b, a in zip(bars, bars[1:])))
        bybit._now = lambda: (int(rows[-1][0]) + HOUR_MS // 2) / 1000      # last bar still forming
        self.assertEqual(len(bybit.closed_only(bars, "60")), 2199)


class Backtest(Base):
    def test_stop_wins_when_bar_touches_both(self):
        bars = [{"t": i, "o": 100, "h": 101, "l": 99, "c": 100, "v": 1} for i in range(260)]
        bars[211] = {"t": 211, "o": 100, "h": 110, "l": 90, "c": 100, "v": 1}
        saved = bybit.signal
        bybit.signal = lambda b, ind, i, n, s=True: (
            {"side": "Buy", "stop_dist": 2.0, "rr": 2.0, "why": "x"} if i == 210 else None)
        try:
            r = bybit.backtest(bars, "trend", fee_pct=0, slip_pct=0)
        finally:
            bybit.signal = saved
        self.assertEqual(r["trades"], 1)
        self.assertEqual(r["list"][0]["why"], "stop")
        self.assertAlmostEqual(r["list"][0]["r"], -1.0)

    def test_fees_cost_r(self):
        bars = [{"t": i, "o": 100, "h": 100.5, "l": 99.5, "c": 100, "v": 1} for i in range(260)]
        bars[212] = {"t": 212, "o": 100, "h": 105, "l": 99.9, "c": 104, "v": 1}
        saved = bybit.signal
        bybit.signal = lambda b, ind, i, n, s=True: (
            {"side": "Buy", "stop_dist": 2.0, "rr": 2.0, "why": "x"} if i == 210 else None)
        try:
            free = bybit.backtest(bars, "trend", fee_pct=0, slip_pct=0)["list"][0]["r"]
            paid = bybit.backtest(bars, "trend", fee_pct=0.1, slip_pct=0)["list"][0]["r"]
        finally:
            bybit.signal = saved
        self.assertAlmostEqual(free, 2.0)
        self.assertAlmostEqual(paid, 2.0 - (100 + 104) * 0.001 / 2.0)

    def test_walk_forward_runs_every_strategy(self):
        bars = synthetic()
        for n in bybit.STRATEGIES:
            ins, out, (v, why) = bybit.walk_forward(bars, n, True, 0.055, 0.02, 1.0)
            self.assertIn(v, ("APROVADA", "REPROVADA", "INCONCLUSIVO"))
            self.assertGreater(ins["trades"] + out["trades"], 0, n)
            self.assertTrue(all(t["t"] >= bars[int(len(bars) * 0.7)]["t"] for t in out["list"]))

    def test_verdict(self):
        good = {"trades": 20, "avg_r": 0.2, "profit_factor": 1.4}
        bad = {"trades": 20, "avg_r": -0.1, "profit_factor": 0.8}
        self.assertEqual(bybit.verdict(good, good)[0], "APROVADA")
        self.assertEqual(bybit.verdict(good, bad)[0], "REPROVADA")
        self.assertEqual(bybit.verdict(good, dict(good, trades=3))[0], "INCONCLUSIVO")


class Sizing(Base):
    def test_risk_sized_bracket_passes(self):
        o = bybit.size_order(plan(), INST, 1000.0, 1000.0, cfg(), [])
        self.assertEqual(o["status"], "PASS", o["reasons"])
        # 1 % of 1000 = 10 USDT; loss per unit 2 + 198 * 0.00055 = 2.1089 -> 4.741
        self.assertEqual(o["decided_by"], "perda maxima por operacao")
        self.assertEqual(o["qty"], "4.741")
        self.assertLessEqual(o["risk_usd"], 10.0)
        self.assertEqual(o["body"]["orderType"], "Market")
        self.assertEqual(o["body"]["stopLoss"], "98.00")
        self.assertEqual(o["body"]["takeProfit"], "104.00")
        self.assertEqual(o["leverage"], 2)
        self.assertLessEqual(len(o["fingerprint"]), 36)

    def test_position_cap_decides_when_tighter(self):
        # 20 % of 1000 at 1x = 200 USDT of position = 2 units, under the 4.741 the risk allows
        o = bybit.size_order(plan(), INST, 1000.0, 1000.0, cfg(max_position_pct=20, max_leverage=1), [])
        self.assertEqual(o["decided_by"], "tamanho maximo da posicao")
        self.assertEqual(o["qty"], "2.000")
        self.assertLess(o["risk_usd"], 10.0)

    def test_rounding_moves_stop_away(self):
        o = bybit.size_order(plan(entry=100.0, stop=98.004, target=104.006), INST, 1000, 1000, cfg(), [])
        self.assertEqual(o["stop"], "98.00")
        self.assertEqual(o["target"], "104.00")
        s = bybit.size_order(plan("Sell", 100.0, 101.996, 95.994), INST, 1000, 1000, cfg(), [])
        self.assertEqual(s["stop"], "102.00")
        self.assertEqual(s["target"], "96.00")

    def test_blocks(self):
        cases = [
            (plan("Sell", 100, 102, 96, category="spot"), cfg(category="spot", fee_pct=0.1), "short"),
            (plan(target=101.0), cfg(), "retorno/risco"),
            (plan(bar_time=int(NOW * 1000) - 10 * HOUR_MS), cfg(), "sinal velho"),
            (plan(), cfg(blocked=["BTCUSDT"]), "bloqueados"),
            (plan(), cfg(max_leverage=25), "alavancagem"),
            (plan(stop=101.0), cfg(), "invalidos"),
        ]
        for p, c, word in cases:
            o = bybit.size_order(p, INST, 1000, 1000, c, [])
            self.assertEqual(o["status"], "BLOCK", word)
            self.assertTrue(any(word in r for r in o["reasons"]), (word, o["reasons"]))

    def test_tiny_account_is_refused_not_shrunk(self):
        o = bybit.size_order(plan(), dict(INST, min_qty="0.1"), 5.0, 5.0, cfg(), [])
        self.assertEqual(o["status"], "BLOCK")
        self.assertTrue(any("pequena demais" in r for r in o["reasons"]))

    def test_daily_limits(self):
        day = bybit.today_utc()
        j = [{"action": "placed", "day": day, "risk_usd": 25.0}]
        o = bybit.size_order(plan(), INST, 1000, 1000, cfg(), j)
        self.assertTrue(any("risco do dia" in r for r in o["reasons"]))
        j = [{"action": "placed", "day": day, "risk_usd": 0.0}] * 4
        o = bybit.size_order(plan(), INST, 1000, 1000, cfg(), j)
        self.assertTrue(any("operacoes por dia" in r for r in o["reasons"]))
        j = [{"action": "placed", "day": "2000-01-01", "risk_usd": 99.0}] * 9
        self.assertEqual(bybit.size_order(plan(), INST, 1000, 1000, cfg(), j)["status"], "PASS")

    def test_spot_is_a_limit_order(self):
        o = bybit.size_order(plan(category="spot"), INST, 1000, 1000, cfg(category="spot", fee_pct=0.1), [])
        self.assertEqual(o["status"], "PASS", o["reasons"])
        self.assertEqual(o["body"]["orderType"], "Limit")
        self.assertEqual(o["body"]["price"], "100.00")
        self.assertEqual(o["leverage"], 1)


class FakeClient:
    base = bybit.TESTNET

    def __init__(self, position=None, leverage_code=None):
        self.calls, self.position, self.leverage_code = [], position, leverage_code

    def private(self, method, route, params):
        self.calls.append((route, params))
        if route == "/v5/position/list":
            return {"list": [self.position] if self.position else []}
        if route == "/v5/position/set-leverage" and self.leverage_code:
            raise bybit.BybitError("x", self.leverage_code)
        if route == "/v5/order/create":
            return {"orderId": "OID1"}
        return {}


class Placing(Base):
    def order(self, **kw):
        return bybit.size_order(plan(**kw), INST, 1000, 1000, cfg(), [])

    def test_places_only_with_yes(self):
        c, j = FakeClient(leverage_code=110043), []
        for reply in ("", "talvez", "nao", "sim e nao"):
            with self.assertRaises(bybit.BybitError):
                bybit.place(c, self.order(), reply, cfg(), j)
        self.assertFalse(any(r == "/v5/order/create" for r, _ in c.calls))
        e = bybit.place(c, self.order(), "Sim!", cfg(), j)
        self.assertEqual(e["order_id"], "OID1")
        self.assertEqual([r for r, _ in c.calls][-2:], ["/v5/position/set-leverage", "/v5/order/create"])
        self.assertEqual(j[0]["reply"], "Sim!")
        with self.assertRaises(bybit.BybitError):          # same order twice
            bybit.place(c, self.order(), "sim", cfg(), j)

    def test_refuses_block_stale_and_open_position(self):
        blocked = self.order(target=100.5)
        with self.assertRaises(bybit.BybitError):
            bybit.place(FakeClient(), blocked, "sim", cfg(), [])
        o = self.order()
        bybit._now = lambda: NOW + 3600
        with self.assertRaises(bybit.BybitError):
            bybit.place(FakeClient(), o, "sim", cfg(), [])
        bybit._now = lambda: NOW
        with self.assertRaises(bybit.BybitError):
            bybit.place(FakeClient(position={"size": "1", "side": "Buy"}), o, "sim", cfg(), [])

    def test_other_leverage_errors_stop_the_order(self):
        c = FakeClient(leverage_code=10001)
        with self.assertRaises(bybit.BybitError):
            bybit.place(c, self.order(), "sim", cfg(), [])
        self.assertFalse(any(r == "/v5/order/create" for r, _ in c.calls))

    def test_mainnet_needs_an_approved_backtest(self):
        p = plan()
        self.assertFalse(bybit.approved(p))
        bybit.save_json("backtest.json", {"results": [
            {"symbol": "BTCUSDT", "strategy": "trend", "interval": "60", "verdict": "REPROVADA"}]})
        self.assertFalse(bybit.approved(p))
        bybit.save_json("backtest.json", {"results": [
            {"symbol": "BTCUSDT", "strategy": "trend", "interval": "60", "verdict": "APROVADA"}]})
        self.assertTrue(bybit.approved(p))
        self.assertFalse(bybit.approved(dict(p, interval="240")))

    def test_close_linear_is_reduce_only(self):
        b = bybit.close_body(FakeClient(position={"size": "0.5", "side": "Buy"}), cfg(), "BTCUSDT")
        self.assertEqual((b["side"], b["qty"], b["reduceOnly"]), ("Sell", "0.5", True))
        self.assertIsNone(bybit.close_body(FakeClient(), cfg(), "BTCUSDT"))


class Cli(Base):
    def run_cli(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = bybit.main(list(argv))
        return code, out.getvalue() + err.getvalue()

    def test_offline_flow(self):
        f = os.path.join(self.tmp.name, "bars.json")
        bars = synthetic()
        with open(f, "w") as fh:
            json.dump(bars, fh)
        code, out = self.run_cli("backtest", "--symbols", "BTCUSDT", "--offline", f, "--write")
        self.assertEqual(code, 0, out)
        self.assertIn("teste :", out)
        self.assertTrue(os.path.exists(os.path.join(self.tmp.name, "backtest.json")))

        # find a bar where some strategy fires, cut the data there, and plan it
        ind = bybit.indicators(bars)
        i = next(i for i in range(bybit.WARMUP, len(bars)) if bybit.signal(bars, ind, i, "trend"))
        with open(f, "w") as fh:
            json.dump(bars[:i + 1], fh)
        bybit._now = lambda: bars[i]["t"] / 1000 + 3600 + 60
        code, out = self.run_cli("signal", "BTCUSDT", "--strategy", "trend", "--offline", f, "--write")
        self.assertEqual(code, 0, out)
        inst = os.path.join(self.tmp.name, "inst.json")
        with open(inst, "w") as fh:
            json.dump(INST, fh)
        os.environ["BYBIT_API_KEY"] = os.environ["BYBIT_API_SECRET"] = "x"
        try:
            code, out = self.run_cli("size", "--equity", "1000", "--instrument", inst)
        finally:
            os.environ.pop("BYBIT_API_KEY")
            os.environ.pop("BYBIT_API_SECRET")
        self.assertIn(code, (0, 2), out)
        self.assertIn("estrategia: trend", out)
        code, out = self.run_cli("show")
        self.assertIn("#1", out)

    def test_treino_is_testnet_only(self):
        f = os.path.join(self.tmp.name, "bars.json")
        bars = synthetic(400)
        with open(f, "w") as fh:
            json.dump(bars, fh)
        bybit._now = lambda: bars[-1]["t"] / 1000 + 3600 + 60
        code, out = self.run_cli("treino", "BTCUSDT", "venda", "--offline", f)
        self.assertEqual(code, 0, out)
        p = bybit.load_json("plan.json", None)
        self.assertEqual((p["side"], p["strategy"]), ("Sell", "treino"))
        self.assertTrue(p["target"] < p["entry"] < p["stop"])
        self.assertEqual(bybit.size_order(p, INST, 1000, 1000, cfg(), [])["status"], "PASS")
        bybit.save_json("config.json", {"mainnet": True})
        os.environ["BYBIT_MAINNET"] = "1"
        code, out = self.run_cli("treino", "BTCUSDT", "compra", "--offline", f)
        self.assertEqual(code, 3)
        self.assertIn("TESTNET", out)

    def test_place_without_reply_is_an_error(self):
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                bybit.main(["place"])


if __name__ == "__main__":
    unittest.main()
