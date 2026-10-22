#!/usr/bin/env python3
"""Reproducible long-only ensemble backtest using local JSON only."""
import argparse, json
from datetime import datetime, timezone

FEE = 0.001
SLIPPAGE = 0.0005
SMA_FAST, SMA_SLOW = 5, 20
MACD_FAST, MACD_SLOW, MACD_SIGNAL = 12, 26, 9
MOMENTUM_LAG = 12


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat()


def ema(values, period):
    out = [None] * len(values)
    if len(values) < period:
        return out
    out[period - 1] = sum(values[:period]) / period
    alpha = 2 / (period + 1)
    for i in range(period, len(values)):
        out[i] = alpha * values[i] + (1 - alpha) * out[i - 1]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data"); ap.add_argument("metadata")
    args = ap.parse_args()
    with open(args.data, encoding="utf-8") as f: rows = json.load(f)
    with open(args.metadata, encoding="utf-8") as f: meta = json.load(f)
    if len(rows) != meta["candleCount"]: raise ValueError("candle count mismatch")
    close = [float(r[4]) for r in rows]
    op = [float(r[1]) for r in rows]
    n = len(rows)
    sma_f = [None] * n; sma_s = [None] * n
    for i in range(n):
        if i >= SMA_FAST - 1: sma_f[i] = sum(close[i-SMA_FAST+1:i+1]) / SMA_FAST
        if i >= SMA_SLOW - 1: sma_s[i] = sum(close[i-SMA_SLOW+1:i+1]) / SMA_SLOW
    fast = ema(close, MACD_FAST); slow = ema(close, MACD_SLOW)
    macd = [None if fast[i] is None or slow[i] is None else fast[i] - slow[i] for i in range(n)]
    macd_vals = [x for x in macd if x is not None]
    sig_partial = ema(macd_vals, MACD_SIGNAL)
    signal = [None] * n
    first = next(i for i, x in enumerate(macd) if x is not None)
    for j, x in enumerate(sig_partial):
        if x is not None: signal[first + j] = x
    warmup = max(SMA_SLOW - 1, first + MACD_SIGNAL - 1, MOMENTUM_LAG)

    def components(i):
        if i < warmup or sma_s[i] is None or signal[i] is None:
            return None
        return {
            "sma": sma_f[i] > sma_s[i],
            "macd": macd[i] > signal[i],
            "momentum": close[i] > close[i - MOMENTUM_LAG],
        }

    cash, qty, active = 1.0, 0.0, None
    trades, events = [], {}
    # Indicators use completed candle i only; order is filled at candle i+1 open.
    for i in range(warmup, n - 1):
        c = components(i)
        if c is None: continue
        score = sum(c.values())
        if qty == 0 and score >= 2:
            raw = op[i+1]; fill = raw * (1 + SLIPPAGE)
            active = {"entry_i": i+1, "entry_time": iso(rows[i+1][0]),
                      "entry_raw_open": raw, "entry_price": fill,
                      "entry_signal_close": close[i], "entry_score": score,
                      "entry_components": c, "entry_cash": cash}
            qty = cash * (1 - FEE) / fill; cash = 0.0; events[i+1] = "entry"
        elif qty > 0 and score < 2:
            raw = op[i+1]; fill = raw * (1 - SLIPPAGE)
            proceeds = qty * fill * (1 - FEE)
            active.update(exit_i=i+1, exit_time=iso(rows[i+1][0]),
                          exit_raw_open=raw, exit_price=fill,
                          exit_signal_close=close[i], exit_score=score,
                          exit_components=c,
                          gross_return=raw / active["entry_raw_open"] - 1,
                          net_return=proceeds / active["entry_cash"] - 1)
            trades.append(active); cash, qty, active = proceeds, 0.0, None
            events[i+1] = "exit"
    if qty > 0:
        raw = close[-1]; fill = raw * (1 - SLIPPAGE); proceeds = qty * fill * (1 - FEE)
        active.update(exit_i=n-1, exit_time=iso(rows[-1][6]), exit_raw_close=raw,
                      exit_price=fill, exit_signal_close=close[-1], exit_score=None,
                      exit_components=None, gross_return=raw / active["entry_raw_open"] - 1,
                      net_return=proceeds / active["entry_cash"] - 1)
        trades.append(active); cash, qty, active = proceeds, 0.0, None; events[n-1] = "exit_final"

    # Mark-to-market net liquidation equity and exposure.
    cash_m, qty_m, held = 1.0, 0.0, 0; equity = []
    for i in range(n):
        event = events.get(i)
        if event == "entry":
            qty_m = cash_m * (1-FEE) / (op[i] * (1+SLIPPAGE)); cash_m = 0.0
        elif event == "exit":
            cash_m = qty_m * op[i] * (1-SLIPPAGE) * (1-FEE); qty_m = 0.0
        if qty_m > 0:
            held += 1; equity.append(qty_m * close[i] * (1-SLIPPAGE) * (1-FEE))
        else: equity.append(cash_m)
        if event == "exit_final":
            cash_m = qty_m * close[i] * (1-SLIPPAGE) * (1-FEE); qty_m = 0.0; equity[-1] = cash_m
    peak, max_dd = equity[0], 0.0
    for v in equity: peak = max(peak, v); max_dd = min(max_dd, v / peak - 1)
    gross = 1.0
    for t in trades: gross *= 1 + t["gross_return"]
    wins = sum(t["net_return"] > 0 for t in trades)
    result = {
        "strategy": "ensemble_2_of_3_sma_macd_momentum_long_only",
        "signals": "enter when at least 2 of: SMA5>SMA20, MACD(12,26)>signal(9), close>close[12]; exit when fewer than 2",
        "symbol": meta["asset"], "bars": n, "interval": meta["interval"],
        "start_utc": iso(rows[0][0]), "end_utc": iso(rows[-1][6]),
        "fee_per_side_pct": FEE*100, "slippage_per_side_pct": SLIPPAGE*100,
        "execution": "completed-close signal; next-candle-open execution; final-close forced exit",
        "gross_return_pct": (gross-1)*100, "net_return_pct": (cash-1)*100,
        "final_cash_per_unit": cash, "trades": len(trades), "winning_trades": wins,
        "win_rate_pct": wins/len(trades)*100 if trades else 0.0,
        "exposure_pct": held/n*100, "close_to_close_max_drawdown_pct": max_dd*100,
        "trade_log": trades,
    }
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__": main()
