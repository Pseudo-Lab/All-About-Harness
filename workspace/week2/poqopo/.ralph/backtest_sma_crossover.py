#!/usr/bin/env python3
"""Reproducible long-only SMA crossover backtest using local JSON only."""
import argparse, json
from datetime import datetime, timezone

FEE = 0.001
SLIPPAGE = 0.0005
FAST, SLOW = 5, 20

def iso(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data"); ap.add_argument("metadata")
    a = ap.parse_args()
    with open(a.data, encoding="utf-8") as f: rows = json.load(f)
    with open(a.metadata, encoding="utf-8") as f: meta = json.load(f)
    if len(rows) != meta["candleCount"]: raise ValueError("candle count mismatch")
    if len(rows) < SLOW + 2: raise ValueError("insufficient candles")
    close = [float(r[4]) for r in rows]; op = [float(r[1]) for r in rows]
    sma_f, sma_s = [None] * len(rows), [None] * len(rows)
    for i in range(len(rows)):
        if i >= FAST - 1: sma_f[i] = sum(close[i-FAST+1:i+1]) / FAST
        if i >= SLOW - 1: sma_s[i] = sum(close[i-SLOW+1:i+1]) / SLOW

    cash, qty, entry = 1.0, 0.0, None
    events = {}
    # Crossovers use bar-i close and are executed at bar-(i+1) open.
    for i in range(SLOW, len(rows) - 1):
        up = sma_f[i-1] <= sma_s[i-1] and sma_f[i] > sma_s[i]
        down = sma_f[i-1] >= sma_s[i-1] and sma_f[i] < sma_s[i]
        if up and qty == 0:
            px = op[i+1] * (1 + SLIPPAGE); entry_cash = cash
            qty = cash * (1 - FEE) / px; cash = 0.0
            entry = {"exec_i": i+1, "price": px, "entry_cash": entry_cash}
            events[i+1] = "entry"
        elif down and qty > 0:
            px = op[i+1] * (1 - SLIPPAGE); proceeds = qty * px * (1 - FEE)
            trades_return = proceeds / entry["entry_cash"] - 1
            events[i+1] = "exit"
            entry.update(exit_i=i+1, exit_price=px, net_return=trades_return,
                         gross_return=px / entry["price"] - 1)
            cash, qty = proceeds, 0.0
            entry = None
    if qty > 0:
        px = close[-1] * (1 - SLIPPAGE); proceeds = qty * px * (1 - FEE)
        entry.update(exit_i=len(rows)-1, exit_price=px,
                     net_return=proceeds / entry["entry_cash"] - 1,
                     gross_return=px / entry["price"] - 1)
        events[len(rows)-1] = "exit_final"
        cash, qty, entry = proceeds, 0.0, None
    trades = []
    if entry is not None: raise AssertionError("unclosed state")
    # Rebuild trade records from event execution pairs using a second lightweight pass.
    cash2, qty2, active = 1.0, 0.0, None
    for i in sorted(events):
        if events[i] == "entry":
            px = op[i] * (1 + SLIPPAGE); active = {"entry_i": i, "entry_price": px, "entry_cash": cash2}
            qty2 = cash2 * (1 - FEE) / px; cash2 = 0.0
        else:
            px = close[i] * (1 - SLIPPAGE) if events[i] == "exit_final" else op[i] * (1 - SLIPPAGE)
            proceeds = qty2 * px * (1 - FEE); active.update(exit_i=i, exit_price=px,
                gross_return=px / active["entry_price"] - 1,
                net_return=proceeds / active["entry_cash"] - 1)
            trades.append(active); cash2, qty2, active = proceeds, 0.0, None
    # Net liquidation equity at each close, including modeled liquidation costs.
    cash3, qty3, active3 = 1.0, 0.0, None; equity = []; held = 0
    for i, row in enumerate(rows):
        event = events.get(i)
        if event == "entry":
            px = op[i] * (1 + SLIPPAGE); qty3 = cash3 * (1-FEE) / px; cash3 = 0.0; active3 = True
        if event == "exit":
            px = op[i] * (1 - SLIPPAGE); cash3, qty3, active3 = qty3 * px * (1-FEE), 0.0, None
        if active3: held += 1
        equity.append(cash3 + (qty3 * close[i] * (1-SLIPPAGE) * (1-FEE) if active3 else 0.0))
        if event == "exit_final":
            px = close[i] * (1 - SLIPPAGE); cash3, qty3, active3 = qty3 * px * (1-FEE), 0.0, None
            equity[-1] = cash3
    peak, max_dd = equity[0], 0.0
    for v in equity: peak = max(peak, v); max_dd = min(max_dd, v / peak - 1)
    net = cash - 1.0; wins = sum(t["net_return"] > 0 for t in trades)
    gross_equity = 1.0
    for t in trades: gross_equity *= 1.0 + t["gross_return"]
    result = {"strategy":"sma_crossover_long_only", "fast_period_bars":FAST, "slow_period_bars":SLOW,
      "symbol":meta["asset"], "bars":len(rows), "interval":meta["interval"],
      "start_utc":iso(rows[0][0]), "end_utc":iso(rows[-1][6]),
      "fee_per_side_pct":FEE*100, "slippage_per_side_pct":SLIPPAGE*100,
      "execution":"completed-close signal, next-candle-open execution, final-close forced exit",
      "gross_return_pct":(gross_equity-1)*100, "net_return_pct":net*100, "final_cash_per_unit":cash, "trades":len(trades),
      "winning_trades":wins, "win_rate_pct":wins/len(trades)*100 if trades else 0.0,
      "exposure_pct":held/len(rows)*100, "close_to_close_max_drawdown_pct":max_dd*100,
      "trade_log":trades}
    print(json.dumps(result, indent=2, sort_keys=True))

if __name__ == "__main__": main()
