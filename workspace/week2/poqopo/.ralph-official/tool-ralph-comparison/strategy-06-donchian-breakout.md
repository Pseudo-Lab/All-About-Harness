# Strategy 06 — Donchian breakout

## Round 6 result

Research-only long/flat Donchian breakout strategy using a 20-candle lookback. A signal is evaluated only after a candle closes against the prior 20 completed closes; any order executes at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Signal: enter when the completed candle close is strictly above the prior 20-candle high; exit when it is strictly below the prior 20-candle low
- Execution: next candle open; long-only, otherwise flat; signals without a following candle are not executable
- Cost model: 0.10% fee + 0.05% adverse slippage per side (0.15% effective each entry/exit)
- Completed round trips: **6** (12 executions including final liquidation)
- First entry: 2026-10-20 12:25 UTC at 81,670.01 raw open (81,792.515015 effective)
- Final liquidation: 2026-10-21 09:15 UTC at 83,584.52 raw close (83,459.143220 effective)
- Net equity: **990.83 USDT**
- Net return after costs: **-0.92%**

The breakout rule generated six long round trips. Several breakouts were followed by reversals, and the accumulated adverse execution costs plus whipsaws left the result below both the 1,000 USDT start and the period's simple price direction. This is one historical 24-hour observation, not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON, used the prior 20 closes (excluding the signal candle) for Donchian high/low levels, generated strict close breakouts, and executed eligible signals at the next candle open. Buys used `open * (1 + 0.0015)` and sells used `open * (1 - 0.0015)`; the final open position was liquidated at `final_close * (1 - 0.0015)`. The result was 990.826149 USDT before display rounding. No orders were submitted and no look-ahead data was used.
