#!/usr/bin/env python3
"""Reproducible long-only momentum strategy with a relative-volatility filter."""
import argparse
import json
import statistics
from datetime import datetime, timezone

FEE = 0.001
SLIPPAGE = 0.0005
MOMENTUM_LOOKBACK = 12
ATR_LOOKBACK = 14
VOL_MEDIAN_LOOKBACK = 20


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
    warmup = max(MOMENTUM_LOOKBACK, ATR_LOOKBACK + VOL_MEDIAN_LOOKBACK - 1)
    if len(rows) < warmup + 2:
        raise ValueError("insufficient candles")

    opens = [float(r[1]) for r in rows]
    highs = [float(r[2]) for r in rows]
    lows = [float(r[3]) for r in rows]
    closes = [float(r[4]) for r in rows]
    true_ranges = []
    for i in range(len(rows)):
        if i == 0:
            true_ranges.append(highs[i] - lows[i])
        else:
            true_ranges.append(max(highs[i] - lows[i],
                                   abs(highs[i] - closes[i - 1]),
                                   abs(lows[i] - closes[i - 1])))
    atr_pct = []
    for i in range(len(rows)):
        start = max(0, i - ATR_LOOKBACK + 1)
        atr = sum(true_ranges[start:i + 1]) / (i - start + 1)
        atr_pct.append(atr / closes[i])

    # Signals are evaluated after candle i closes. The volatility median uses
    # only the 20 ATR percentages before i; entry/exit fills occur at i+1 open.
    cash, qty, active = 1.0, 0.0, None
    trades, events = [], {}
    for i in range(warmup, len(rows) - 1):
        prior_vol_median = statistics.median(atr_pct[i - VOL_MEDIAN_LOOKBACK:i])
        momentum_positive = closes[i] > closes[i - MOMENTUM_LOOKBACK]
        low_relative_volatility = atr_pct[i] <= prior_vol_median
        if qty == 0 and momentum_positive and low_relative_volatility:
            raw = opens[i + 1]
            fill = raw * (1 + SLIPPAGE)
            active = {"entry_i": i + 1, "entry_time": iso(rows[i + 1][0]),
                      "entry_price": fill, "entry_raw_open": raw,
                      "entry_signal_close": closes[i],
                      "entry_momentum_return_pct": (closes[i] / closes[i - MOMENTUM_LOOKBACK] - 1) * 100,
                      "entry_atr_pct": atr_pct[i] * 100,
                      "prior_vol_median_pct": prior_vol_median * 100,
                      "entry_cash": cash}
            qty = cash * (1 - FEE) / fill
            cash = 0.0
            events[i + 1] = "entry"
        elif qty > 0 and not momentum_positive:
            raw = opens[i + 1]
            fill = raw * (1 - SLIPPAGE)
            proceeds = qty * fill * (1 - FEE)
            active.update(exit_i=i + 1, exit_time=iso(rows[i + 1][0]),
                          exit_price=fill, exit_raw_open=raw,
                          exit_signal_close=closes[i],
                          exit_momentum_return_pct=(closes[i] / closes[i - MOMENTUM_LOOKBACK] - 1) * 100,
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
                      exit_signal_close=closes[-1], exit_momentum_return_pct=(closes[-1] / closes[-1 - MOMENTUM_LOOKBACK] - 1) * 100,
                      gross_return=raw / active["entry_raw_open"] - 1,
                      net_return=proceeds / active["entry_cash"] - 1)
        trades.append(active)
        events[len(rows) - 1] = "exit_final"
        cash, qty, active = proceeds, 0.0, None

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
        "strategy": "momentum_volatility_filter_long_only",
        "momentum_lookback_bars": MOMENTUM_LOOKBACK,
        "atr_lookback_bars": ATR_LOOKBACK,
        "volatility_median_lookback_bars": VOL_MEDIAN_LOOKBACK,
        "entry_rule": "completed close > close 12 bars earlier AND current 14-bar ATR/close <= median ATR/close of prior 20 completed bars",
        "exit_rule": "completed close <= close 12 bars earlier",
        "symbol": meta["asset"], "bars": len(rows), "interval": meta["interval"],
        "start_utc": iso(rows[0][0]), "end_utc": iso(rows[-1][6]),
        "fee_per_side_pct": FEE * 100, "slippage_per_side_pct": SLIPPAGE * 100,
        "execution": "signals evaluated after completed candle close; next-candle-open execution; final-close forced exit",
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
