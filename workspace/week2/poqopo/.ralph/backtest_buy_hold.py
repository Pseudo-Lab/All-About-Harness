#!/usr/bin/env python3
"""Reproducible BTCUSDT 5-minute buy-and-hold backtest using local JSON only."""
import argparse
import json
from datetime import datetime, timezone

FEE = 0.001       # 0.10% per side
SLIPPAGE = 0.0005 # 0.05% adverse price impact per side

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
        metadata = json.load(f)
    if len(rows) != metadata["candleCount"]:
        raise ValueError("candle count does not match metadata")
    if not rows:
        raise ValueError("empty data")

    initial_cash = 1.0
    first_open = float(rows[0][1])
    last_close = float(rows[-1][4])
    entry_price = first_open * (1 + SLIPPAGE)
    quantity = initial_cash * (1 - FEE) / entry_price
    exit_price = last_close * (1 - SLIPPAGE)
    final_cash = quantity * exit_price * (1 - FEE)
    gross_return = last_close / first_open - 1
    net_return = final_cash / initial_cash - 1

    # Close-to-close mark-to-market drawdown while continuously long.
    equity = [quantity * float(row[4]) for row in rows]
    peak = equity[0]
    max_dd = 0.0
    peak_i = trough_i = 0
    for i, value in enumerate(equity):
        if value > peak:
            peak, peak_i = value, i
        drawdown = value / peak - 1
        if drawdown < max_dd:
            max_dd, trough_i = drawdown, i

    # Conservative intrabar drawdown using each candle high as a running peak
    # and low as the subsequent trough; this is a descriptive risk metric.
    high_peak = quantity * float(rows[0][2])
    intrabar_dd = 0.0
    intrabar_peak_i = intrabar_trough_i = 0
    for i, row in enumerate(rows):
        high_peak = max(high_peak, quantity * float(row[2]))
        if high_peak == quantity * float(row[2]):
            intrabar_peak_i = i
        drawdown = (quantity * float(row[3])) / high_peak - 1
        if drawdown < intrabar_dd:
            intrabar_dd, intrabar_trough_i = drawdown, i

    result = {
        "strategy": "buy_and_hold",
        "symbol": metadata["asset"],
        "bars": len(rows),
        "interval": metadata["interval"],
        "start_utc": iso(rows[0][0]),
        "end_utc": iso(rows[-1][6]),
        "first_open": first_open,
        "last_close": last_close,
        "gross_return_pct": gross_return * 100,
        "fee_per_side_pct": FEE * 100,
        "slippage_per_side_pct": SLIPPAGE * 100,
        "net_return_pct": net_return * 100,
        "final_cash_per_unit": final_cash,
        "round_trips": 1,
        "exposure_pct": 100.0,
        "close_to_close_max_drawdown_pct": max_dd * 100,
        "intrabar_high_low_max_drawdown_pct": intrabar_dd * 100,
        "entry_time_utc": iso(rows[0][0]),
        "exit_time_utc": iso(rows[-1][6]),
    }
    print(json.dumps(result, indent=2, sort_keys=True))

if __name__ == "__main__":
    main()
