#!/usr/bin/env python3
"""Reproducible long-only EMA crossover backtest using local JSON only."""
import argparse, json
from datetime import datetime, timezone

FEE = 0.001
SLIPPAGE = 0.0005
FAST, SLOW = 5, 20


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("metadata")
    a = ap.parse_args()
    with open(a.data, encoding="utf-8") as f:
        rows = json.load(f)
    with open(a.metadata, encoding="utf-8") as f:
        meta = json.load(f)
    if len(rows) != meta["candleCount"]:
        raise ValueError("candle count mismatch")
    if len(rows) < SLOW + 2:
        raise ValueError("insufficient candles")

    close = [float(r[4]) for r in rows]
    op = [float(r[1]) for r in rows]
    ema_f, ema_s = [None] * len(rows), [None] * len(rows)
    # Seed each EMA with its period SMA; values become available without
    # using any future candle beyond the current index.
    ema_f[FAST - 1] = sum(close[:FAST]) / FAST
    ema_s[SLOW - 1] = sum(close[:SLOW]) / SLOW
    alpha_f, alpha_s = 2 / (FAST + 1), 2 / (SLOW + 1)
    for i in range(FAST, len(rows)):
        ema_f[i] = close[i] * alpha_f + ema_f[i - 1] * (1 - alpha_f)
    for i in range(SLOW, len(rows)):
        ema_s[i] = close[i] * alpha_s + ema_s[i - 1] * (1 - alpha_s)

    events = {}
    # Crossovers use completed bar i close and execute at bar i+1 open.
    cash, qty, active = 1.0, 0.0, None
    trades = []
    for i in range(SLOW, len(rows) - 1):
        up = ema_f[i - 1] <= ema_s[i - 1] and ema_f[i] > ema_s[i]
        down = ema_f[i - 1] >= ema_s[i - 1] and ema_f[i] < ema_s[i]
        if up and qty == 0:
            px = op[i + 1] * (1 + SLIPPAGE)
            active = {"entry_i": i + 1, "entry_price": px, "entry_cash": cash}
            qty = cash * (1 - FEE) / px
            cash = 0.0
            events[i + 1] = "entry"
        elif down and qty > 0:
            px = op[i + 1] * (1 - SLIPPAGE)
            proceeds = qty * px * (1 - FEE)
            active.update(exit_i=i + 1, exit_price=px,
                          gross_return=px / active["entry_price"] - 1,
                          net_return=proceeds / active["entry_cash"] - 1)
            trades.append(active)
            cash, qty, active = proceeds, 0.0, None
            events[i + 1] = "exit"

    if qty > 0:
        px = close[-1] * (1 - SLIPPAGE)
        proceeds = qty * px * (1 - FEE)
        active.update(exit_i=len(rows) - 1, exit_price=px,
                      gross_return=px / active["entry_price"] - 1,
                      net_return=proceeds / active["entry_cash"] - 1)
        trades.append(active)
        events[len(rows) - 1] = "exit_final"
        cash, qty, active = proceeds, 0.0, None

    # Mark-to-market equity at each close, including modeled liquidation costs.
    cash_m, qty_m, held = 1.0, 0.0, 0
    equity = []
    for i in range(len(rows)):
        event = events.get(i)
        if event == "entry":
            px = op[i] * (1 + SLIPPAGE)
            qty_m = cash_m * (1 - FEE) / px
            cash_m = 0.0
        elif event == "exit":
            px = op[i] * (1 - SLIPPAGE)
            cash_m, qty_m = qty_m * px * (1 - FEE), 0.0
        if qty_m > 0:
            held += 1
            equity.append(qty_m * close[i] * (1 - SLIPPAGE) * (1 - FEE))
        else:
            equity.append(cash_m)
        if event == "exit_final":
            cash_m = qty_m * close[i] * (1 - SLIPPAGE) * (1 - FEE)
            qty_m = 0.0
            equity[-1] = cash_m

    peak, max_dd = equity[0], 0.0
    for value in equity:
        peak = max(peak, value)
        max_dd = min(max_dd, value / peak - 1)
    gross_equity = 1.0
    for trade in trades:
        gross_equity *= 1 + trade["gross_return"]
    wins = sum(t["net_return"] > 0 for t in trades)
    result = {
        "strategy": "ema_crossover_long_only", "fast_period_bars": FAST,
        "slow_period_bars": SLOW, "symbol": meta["asset"], "bars": len(rows),
        "interval": meta["interval"], "start_utc": iso(rows[0][0]),
        "end_utc": iso(rows[-1][6]), "fee_per_side_pct": FEE * 100,
        "slippage_per_side_pct": SLIPPAGE * 100,
        "execution": "completed-close signal, next-candle-open execution, final-close forced exit",
        "gross_return_pct": (gross_equity - 1) * 100,
        "net_return_pct": (cash - 1) * 100, "final_cash_per_unit": cash,
        "trades": len(trades), "winning_trades": wins,
        "win_rate_pct": wins / len(trades) * 100 if trades else 0.0,
        "exposure_pct": held / len(rows) * 100,
        "close_to_close_max_drawdown_pct": max_dd * 100,
        "trade_log": trades,
    }
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
