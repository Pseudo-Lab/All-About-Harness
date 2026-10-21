# Strategy 04 — RSI mean reversion

## Round 4 result

Research-only long/flat RSI mean-reversion strategy using 14-period Wilder RSI. A signal is evaluated only after a candle closes; any order executes at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Signal: enter long when RSI(14) crosses below 30; exit when RSI(14) crosses above 50
- RSI initialization: Wilder averages seeded from the first 14 close-to-close changes
- Execution: next candle open; long-only, otherwise flat
- Cost model: 0.10% fee + 0.05% adverse slippage per side (0.15% effective each entry/exit)
- RSI range after initialization: **32.82 to 83.71**
- Completed round trips: **0** (0 executions)
- Net equity: **1,000.00 USDT**
- Net return after costs: **0.00%**

RSI never reached the entry threshold below 30 during this one-day sample, so the strategy remained flat and incurred no costs. This is one historical 24-hour observation, not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON, computed close-only Wilder RSI(14), generated the strict threshold-crossing signals, and checked the next candle open for execution. Because the minimum initialized RSI was 32.82, no entry was eligible; no orders were submitted and no look-ahead data was used. The result is research-only and does not establish profitability or suitability.
