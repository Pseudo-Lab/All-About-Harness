# Strategy 07 — Momentum plus volatility filter

## Round 7 result

Research-only long/flat strategy combining 24-candle momentum with a low-volatility filter. Signals are evaluated only after a candle closes; eligible orders execute at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Signal: long when the completed close is above the close 24 candles earlier **and** population standard deviation of the latest 20 completed log returns is at most 0.30%; exit when either condition is false
- Execution: next candle open; long-only, otherwise flat; signals without a following candle are not executable
- Cost model: 0.10% fee + 0.05% adverse slippage per side (0.15% effective each entry/exit)
- Completed round trips: **17** (34 executions, including final liquidation)
- First entry: 2026-10-20 11:25 UTC at 81,530.26 raw open (81,652.555390 effective)
- Final liquidation: 2026-10-21 09:15 UTC at 83,584.52 raw close (83,459.143220 effective)
- Net equity: **962.86 USDT**
- Net return after costs: **-3.71%**

The filter did not prevent frequent short-lived entries and exits: 17 round trips accumulated execution costs and whipsaws. The result was below the 1,000 USDT start despite the period's positive close-to-close move. This is one historical 24-hour observation, not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON, used only the prior 24 completed closes for momentum and the latest 20 completed log returns for volatility, generated the signal after each close, and executed eligible signals at the next candle open. Buys used `open * (1 + 0.0015)` and sells used `open * (1 - 0.0015)`; the final open position was liquidated at `final_close * (1 - 0.0015)`. The result was 962.8625916532138 USDT before display rounding. No orders were submitted and no look-ahead data was used.
