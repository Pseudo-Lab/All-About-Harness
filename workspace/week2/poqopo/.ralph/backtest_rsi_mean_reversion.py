#!/usr/bin/env python3
"""Reproducible long-only RSI mean-reversion backtest using local JSON only."""
import argparse, json
from datetime import datetime, timezone

FEE = 0.001
SLIPPAGE = 0.0005
RSI_PERIOD = 14
ENTRY_RSI = 30.0
EXIT_RSI = 70.0


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat()


def rsi_wilder(closes, period):
    values = [None] * len(closes)
    gains = [max(closes[i] - closes[i - 1], 0.0) for i in range(1, len(closes))]
    losses = [max(closes[i - 1] - closes[i], 0.0) for i in range(1, len(closes))]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    def calc(g, l):
        if l == 0:
            return 100.0 if g > 0 else 50.0
        return 100.0 - 100.0 / (1.0 + g / l)
    values[period] = calc(avg_gain, avg_loss)
    for i in range(period + 1, len(closes)):
        avg_gain = (avg_gain * (period - 1) + gains[i - 1]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i - 1]) / period
        values[i] = calc(avg_gain, avg_loss)
    return values


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
    if len(rows) < RSI_PERIOD + 2:
        raise ValueError("insufficient candles")

    close = [float(r[4]) for r in rows]
    op = [float(r[1]) for r in rows]
    rsi = rsi_wilder(close, RSI_PERIOD)

    # RSI is evaluated on completed candle i and any order fills at candle i+1 open.
    cash, qty, active = 1.0, 0.0, None
    trades, events = [], {}
    for i in range(RSI_PERIOD, len(rows) - 1):
        if rsi[i] is None:
            continue
        if qty == 0 and rsi[i] <= ENTRY_RSI:
            px = op[i + 1] * (1 + SLIPPAGE)
            active = {"entry_i": i + 1, "entry_price": px, "entry_rsi": rsi[i], "entry_cash": cash}
            qty = cash * (1 - FEE) / px
            cash = 0.0
            events[i + 1] = "entry"
        elif qty > 0 and rsi[i] >= EXIT_RSI:
            px = op[i + 1] * (1 - SLIPPAGE)
            proceeds = qty * px * (1 - FEE)
            active.update(exit_i=i + 1, exit_price=px, exit_rsi=rsi[i],
                          gross_return=px / active["entry_price"] - 1,
                          net_return=proceeds / active["entry_cash"] - 1)
            trades.append(active)
            cash, qty, active = proceeds, 0.0, None
            events[i + 1] = "exit"

    if qty > 0:
        px = close[-1] * (1 - SLIPPAGE)
        proceeds = qty * px * (1 - FEE)
        active.update(exit_i=len(rows) - 1, exit_price=px, exit_rsi=rsi[-1],
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
        "strategy": "rsi_mean_reversion_long_only", "rsi_period_bars": RSI_PERIOD,
        "entry_rsi_lte": ENTRY_RSI, "exit_rsi_gte": EXIT_RSI,
        "symbol": meta["asset"], "bars": len(rows), "interval": meta["interval"],
        "start_utc": iso(rows[0][0]), "end_utc": iso(rows[-1][6]),
        "fee_per_side_pct": FEE * 100, "slippage_per_side_pct": SLIPPAGE * 100,
        "execution": "Wilder RSI on completed closes; next-candle-open execution; final-close forced exit",
        "gross_return_pct": (gross_equity - 1) * 100, "net_return_pct": (cash - 1) * 100,
        "final_cash_per_unit": cash, "trades": len(trades), "winning_trades": wins,
        "win_rate_pct": wins / len(trades) * 100 if trades else 0.0,
        "exposure_pct": held / len(rows) * 100,
        "close_to_close_max_drawdown_pct": max_dd * 100, "trade_log": trades,
    }
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
