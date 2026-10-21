#!/usr/bin/env python3
"""Reproducible fixed-grid, long-only BTCUSDT backtest using resting limits."""
import argparse
import json
from datetime import datetime, timezone

FEE = 0.001
SLIPPAGE = 0.0005
SPACING = 0.0025
Rungs = 4


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
    if len(rows) < 2:
        raise ValueError("need at least two candles")

    opens = [float(r[1]) for r in rows]
    highs = [float(r[2]) for r in rows]
    lows = [float(r[3]) for r in rows]
    closes = [float(r[4]) for r in rows]
    anchor = opens[0]  # known before the first candle is processed
    allocation = 1.0 / Rungs
    slots = []
    for k in range(1, Rungs + 1):
        buy_level = anchor * (1 - SPACING * k)
        slots.append({"slot": k, "buy_level": buy_level,
                      "sell_level": buy_level + anchor * SPACING,
                      "position": None})

    cash = 1.0
    trades = []
    events = {}
    held_bars = 0
    equity = []
    # Resting orders are known before each candle. With OHLC-only data, exits
    # are processed before entries when both sides are touched in one candle.
    for i in range(len(rows)):
        event_labels = []
        for slot in slots:
            pos = slot["position"]
            if pos is not None and highs[i] >= slot["sell_level"]:
                raw = slot["sell_level"]
                fill = raw * (1 - SLIPPAGE)
                proceeds = pos["qty"] * fill * (1 - FEE)
                trades.append({
                    "slot": slot["slot"], "entry_i": pos["entry_i"],
                    "entry_time": pos["entry_time"], "entry_price": pos["fill"],
                    "entry_level": pos["raw"], "exit_i": i,
                    "exit_time": iso(rows[i][6]), "exit_price": fill,
                    "exit_level": raw, "gross_return": raw / pos["raw"] - 1,
                    "net_return": proceeds / pos["cash_committed"] - 1,
                    "exit_reason": "grid_next_upper_level",
                })
                cash += proceeds
                slot["position"] = None
                event_labels.append("exit")
        for slot in slots:
            if slot["position"] is None and lows[i] <= slot["buy_level"]:
                raw = slot["buy_level"]
                fill = raw * (1 + SLIPPAGE)
                committed = min(allocation, cash / (1 + FEE))
                if committed <= 0:
                    continue
                qty = committed * (1 - FEE) / fill
                cash -= committed
                slot["position"] = {"entry_i": i, "entry_time": iso(rows[i][0]),
                                     "raw": raw, "fill": fill, "qty": qty,
                                     "cash_committed": committed}
                event_labels.append("entry")
        if event_labels:
            events[i] = ",".join(event_labels)
        marked = cash
        open_count = 0
        for slot in slots:
            if slot["position"] is not None:
                open_count += 1
                marked += slot["position"]["qty"] * closes[i] * (1 - SLIPPAGE) * (1 - FEE)
        if open_count:
            held_bars += 1
        equity.append(marked)

    # Force liquidation at final close; do not use any future information.
    for slot in slots:
        pos = slot["position"]
        if pos is not None:
            raw = closes[-1]
            fill = raw * (1 - SLIPPAGE)
            proceeds = pos["qty"] * fill * (1 - FEE)
            trades.append({
                "slot": slot["slot"], "entry_i": pos["entry_i"],
                "entry_time": pos["entry_time"], "entry_price": pos["fill"],
                "entry_level": pos["raw"], "exit_i": len(rows) - 1,
                "exit_time": iso(rows[-1][6]), "exit_price": fill,
                "exit_level": raw, "gross_return": raw / pos["raw"] - 1,
                "net_return": proceeds / pos["cash_committed"] - 1,
                "exit_reason": "final_close_forced_exit",
            })
            cash += proceeds
            slot["position"] = None
    equity[-1] = cash

    peak = equity[0]
    max_dd = 0.0
    for value in equity:
        peak = max(peak, value)
        max_dd = min(max_dd, value / peak - 1)
    gross = 1.0
    for trade in trades:
        gross *= 1 + trade["gross_return"]
    wins = sum(t["net_return"] > 0 for t in trades)
    result = {
        "strategy": "fixed_grid_long_only", "grid_spacing_pct": SPACING * 100,
        "rungs": Rungs, "anchor_price": anchor,
        "entry_rule": "resting buy limits at anchor minus 0.25%, 0.50%, 0.75%, and 1.00%; each fills when candle low touches level",
        "exit_rule": "resting sell limit one grid spacing above each filled buy; final close liquidates any remainder",
        "symbol": meta["asset"], "bars": len(rows), "interval": meta["interval"],
        "start_utc": iso(rows[0][0]), "end_utc": iso(rows[-1][6]),
        "fee_per_side_pct": FEE * 100, "slippage_per_side_pct": SLIPPAGE * 100,
        "execution": "orders established from first open; OHLC touch fills at limit levels; exits processed before entries on same candle; final-close forced exit",
        "gross_return_pct": (gross - 1) * 100, "net_return_pct": (cash - 1) * 100,
        "final_cash_per_unit": cash, "trades": len(trades),
        "winning_trades": wins, "win_rate_pct": wins / len(trades) * 100 if trades else 0.0,
        "exposure_pct": held_bars / len(rows) * 100,
        "close_to_close_max_drawdown_pct": max_dd * 100,
        "trade_log": trades, "event_count": len(events),
    }
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
