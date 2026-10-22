# Strategy 03 — EMA crossover

## Round 3 result

Research-only long/flat strategy using 20-candle and 50-candle exponential moving averages (EMA). A strict crossover is evaluated only after each candle closes; orders execute at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Signal: buy when EMA(20) crosses above EMA(50); sell when it crosses below
- EMA initialization: each EMA starts from its period SMA, then uses `2/(period+1)` smoothing
- Execution: next candle open; positions are long-only, otherwise flat
- Cost model: 0.10% fee + 0.05% adverse slippage per side (0.15% effective each entry/exit)
- Completed round trips: **2** (4 executions including final liquidation)
- Entries: 2026-10-20 13:40 UTC at 81,862.620015 effective; 2026-10-21 07:30 UTC at 83,224.650000 effective
- Exit: 2026-10-21 02:25 UTC at 82,633.872985 effective, then final liquidation 2026-10-21 09:15 UTC at 83,459.143220 effective
- Net equity: **1,012.27 USDT**
- Net return after costs: **+1.23%**

The EMA strategy captured two long legs and finished below the buy-and-hold result for this sample after costs, while avoiding the SMA strategy's six round trips. This is one historical 24-hour observation, not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON, computed close-only EMA(20) and EMA(50) with SMA seeding, generated strict crossovers at candle close, and executed eligible signals at the next candle open. Each buy used `open * (1 + 0.0015)` and each sell used `open * (1 - 0.0015)`; the final open position was liquidated at `final_close * (1 - 0.0015)`. No orders were submitted and no look-ahead data was used.
