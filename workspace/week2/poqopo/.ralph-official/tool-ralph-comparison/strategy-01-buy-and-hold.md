# Strategy 01 — Buy-and-hold

## Round 1 result

Research-only long exposure over the complete local sample. Buy at the first candle's open and liquidate at the final candle's close. No signal timing or look-ahead is involved. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Entry open: 81,577.01
- Exit close: 83,584.52
- Cost model: 0.10% fee + 0.05% adverse slippage per side
- Effective buy price: 81,699.375515
- Effective sell price: 83,459.143220
- Gross price return: **+2.46%**
- Net equity: **1,021.54 USDT**
- Net return after costs: **+2.15%**

## Reproduction

The result was generated locally with Python's standard `json` and `decimal` modules by loading the dataset, using `cost = 0.0010 + 0.0005`, and evaluating:

`final = 1000 * exit_close * (1 - cost) / (entry_open * (1 + cost))`

Rounded display is to two decimals; no orders were submitted. This is a one-sample historical observation, not investment advice.
