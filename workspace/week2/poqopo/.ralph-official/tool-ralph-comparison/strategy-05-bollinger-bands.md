# Strategy 05 — Bollinger Bands

## Round 5 result

Research-only long/flat Bollinger Bands mean-reversion strategy using a 20-candle simple moving average and 2.0 population standard deviations. A signal is evaluated only after a candle closes; any order executes at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Signal: enter when the close strictly crosses below the lower band; exit when the close strictly crosses above the middle (20-candle SMA) band
- Execution: next candle open; long-only, otherwise flat; duplicate signals while already in the same state are ignored
- Cost model: 0.10% fee + 0.05% adverse slippage per side (0.15% effective each entry/exit)
- Completed round trips: **4** (8 executions; no final liquidation was needed because no position remained open)
- Executed entries: 2026-10-20 12:10 UTC at 81,488.059015 effective; 18:25 UTC at 82,720.575020; 2026-10-21 01:10 UTC at 82,960.254000; 05:45 UTC at 82,848.086000
- Executed exits: 2026-10-20 12:20 UTC at 81,419.537225 effective; 19:45 UTC at 82,490.088985; 2026-10-21 01:50 UTC at 83,047.242000; 06:35 UTC at 82,781.321480
- Net equity: **996.62 USDT**
- Net return after costs: **-0.34%**

The strategy produced four short-lived long trades; all four lost after the adverse execution assumptions, leaving equity slightly below the 1,000 USDT start. This is one historical 24-hour observation, not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON, computed close-only rolling SMA(20) and population standard deviation, generated strict lower-band and middle-band crossing signals, and executed eligible signals at the next candle open. Buys used `open * (1 + 0.0015)` and sells used `open * (1 - 0.0015)`. Signals without a following candle were not executable; no look-ahead data was used. The result is research-only and does not establish profitability or suitability.
