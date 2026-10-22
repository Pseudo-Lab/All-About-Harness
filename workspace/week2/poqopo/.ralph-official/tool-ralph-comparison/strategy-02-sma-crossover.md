# Strategy 02 — SMA crossover

## Round 2 result

Research-only long/flat strategy using a 20-candle SMA and 50-candle SMA. A strict crossover is evaluated only after each candle closes; orders execute at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Signal: buy when SMA(20) crosses above SMA(50); sell when it crosses below
- Execution: next candle open; positions are long-only, otherwise flat
- Cost model: 0.10% fee + 0.05% adverse slippage per side (0.15% effective each entry/exit)
- Completed round trips: **6** (12 executions including final liquidation)
- First entry: 2026-10-20 13:40 UTC at 81,740.01 raw open (81,862.620015 effective)
- Final liquidation: 2026-10-21 09:15 UTC at 83,584.52 raw close (83,459.143220 effective)
- Net equity: **997.86 USDT**
- Net return after costs: **-0.21%**

The strategy was profitable on several directional legs, but repeated whipsaws and six round trips made its net result slightly worse than holding BTC for this sample. This is one historical 24-hour observation, not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON, computed close-only rolling SMA(20) and SMA(50), generated strict crossovers at candle close, and executed eligible signals at the next candle open. Each buy used `open * (1 + 0.0015)` and each sell used `open * (1 - 0.0015)`; the final open position was liquidated at `final_close * (1 - 0.0015)`. No orders were submitted and no look-ahead data was used.
