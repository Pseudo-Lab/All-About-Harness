# Strategy 08 — MACD crossover

## Round 8 result

Research-only long/flat strategy using the standard MACD(12,26,9) crossover. Signals are evaluated only after a candle closes; orders execute at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Signal: buy when MACD(12,26) crosses strictly above its 9-candle signal EMA; sell when it crosses strictly below
- Indicator calculation: close-only EMA(12) and EMA(26), each initialized with its period SMA; the signal EMA(9) is initialized from the first nine available MACD values
- Execution: next candle open; long-only, otherwise flat; signals without a following candle are not executable
- Cost model: 0.10% fee + 0.05% adverse slippage per side (0.15% effective each entry/exit)
- Completed round trips: **10** (20 executions, including final liquidation)
- First entry: 2026-10-20 12:25 UTC at 81,792.515015 effective
- Final liquidation: 2026-10-21 09:15 UTC at 83,459.143220 effective
- Net equity: **985.95 USDT**
- Net return after costs: **-1.40%**

MACD produced repeated crossovers and ten long round trips in this 24-hour sample. The strategy finished below the 1,000 USDT start after whipsaws and execution costs, despite the period's positive close-to-close move. This is one historical 24-hour observation, not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON, used only completed closes, seeded EMA(12) and EMA(26) with their period SMAs, then seeded EMA(9) from the first nine available MACD values. Strict crossovers were generated after each close and eligible signals executed at the next candle open. Buys used `open * (1 + 0.0015)` and sells used `open * (1 - 0.0015)`; the final open position was liquidated at `final_close * (1 - 0.0015)`. The result was 985.9536784499822 USDT before display rounding. No orders were submitted and no look-ahead data was used.
