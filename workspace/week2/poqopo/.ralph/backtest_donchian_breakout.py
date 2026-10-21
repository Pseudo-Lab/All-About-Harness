#!/usr/bin/env python3
"""Reproducible long-only Donchian breakout backtest."""
import argparse, json
from datetime import datetime, timezone

FEE = 0.001
SLIPPAGE = 0.0005
ENTRY_LOOKBACK = 20
EXIT_LOOKBACK = 10


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("metadata")
    args = ap.parse_args()
    with open(args.data, encoding="utf-8") as f:
        rows = json.load(f)
    with open(args.metadata, encoding="utf-8") as f:
        meta = json.load(f)
    if len(rows) != meta["candleCount"]:
        raise ValueError("candle count mismatch")
    warmup = max(ENTRY_LOOKBACK, EXIT_LOOKBACK)
    if len(rows) < warmup + 2:
        raise ValueError("insufficient candles")

    opens = [float(r[1]) for r in rows]
    highs = [float(r[2]) for r in rows]
    lows = [float(r[3]) for r in rows]
    closes = [float(r[4]) for r in rows]

    # At completed candle i, channels use only candles strictly before i.
    cash, qty, active = 1.0, 0.0, None
    trades, events = [], {}
    for i in range(warmup, len(rows) - 1):
        prior_high = max(highs[i - ENTRY_LOOKBACK:i])
        prior_low = min(lows[i - EXIT_LOOKBACK:i])
        if qty == 0 and closes[i] > prior_high:
            raw = opens[i + 1]
            fill = raw * (1 + SLIPPAGE)
            active = {"entry_i": i + 1, "entry_time": iso(rows[i + 1][0]),
                      "entry_price": fill, "entry_raw_open": raw,
                      "entry_signal_close": closes[i], "entry_prior_high": prior_high,
                      "entry_cash": cash}
            qty = cash * (1 - FEE) / fill
            cash = 0.0
            events[i + 1] = "entry"
        elif qty > 0 and closes[i] < prior_low:
            raw = opens[i + 1]
            fill = raw * (1 - SLIPPAGE)
            proceeds = qty * fill * (1 - FEE)
            active.update(exit_i=i + 1, exit_time=iso(rows[i + 1][0]),
                          exit_price=fill, exit_raw_open=raw,
                          exit_signal_close=closes[i], exit_prior_low=prior_low,
                          gross_return=raw / active["entry_raw_open"] - 1,
                          net_return=proceeds / active["entry_cash"] - 1)
            trades.append(active)
            cash, qty, active = proceeds, 0.0, None
            events[i + 1] = "exit"

    if qty > 0:
        raw = closes[-1]
        fill = raw * (1 - SLIPPAGE)
        proceeds = qty * fill * (1 - FEE)
        active.update(exit_i=len(rows) - 1, exit_time=iso(rows[-1][6]),
                      exit_price=fill, exit_raw_close=raw,
                      exit_signal_close=closes[-1], exit_prior_low=None,
                      gross_return=raw / active["entry_raw_open"] - 1,
                      net_return=proceeds / active["entry_cash"] - 1)
        trades.append(active)
        events[len(rows) - 1] = "exit_final"
        cash, qty, active = proceeds, 0.0, None

    # Mark-to-market close-to-close equity, conservatively including exit costs.
    cash_m, qty_m, held = 1.0, 0.0, 0
    equity = []
    for i in range(len(rows)):
        event = events.get(i)
        if event == "entry":
            qty_m = cash_m * (1 - FEE) / (opens[i] * (1 + SLIPPAGE))
            cash_m = 0.0
        elif event == "exit":
            cash_m = qty_m * opens[i] * (1 - SLIPPAGE) * (1 - FEE)
            qty_m = 0.0
        if qty_m > 0:
            held += 1
            equity.append(qty_m * closes[i] * (1 - SLIPPAGE) * (1 - FEE))
        else:
            equity.append(cash_m)
        if event == "exit_final":
            cash_m = qty_m * closes[i] * (1 - SLIPPAGE) * (1 - FEE)
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
        "strategy": "donchian_breakout_long_only",
        "entry_lookback_bars": ENTRY_LOOKBACK, "exit_lookback_bars": EXIT_LOOKBACK,
        "entry_rule": "completed close > prior 20-candle high", "exit_rule": "completed close < prior 10-candle low",
        "symbol": meta["asset"], "bars": len(rows), "interval": meta["interval"],
        "start_utc": iso(rows[0][0]), "end_utc": iso(rows[-1][6]),
        "fee_per_side_pct": FEE * 100, "slippage_per_side_pct": SLIPPAGE * 100,
        "execution": "channels use completed candles strictly before signal candle; signal after close; next-candle-open execution; final-close forced exit",
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
