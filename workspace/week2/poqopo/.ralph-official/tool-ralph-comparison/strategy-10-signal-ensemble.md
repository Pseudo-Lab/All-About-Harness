# Strategy 10 — Signal ensemble

## Round 10 result

Research-only long/flat ensemble combining five close-based signals: SMA(20)>SMA(50), EMA(12)>EMA(26), RSI(14)<30, close below the lower Bollinger(20, 2σ) band, and MACD(12,26)>signal EMA(9). A bullish vote is +1, a bearish vote is -1, and neutral is 0. Enter when the completed-candle vote total is at least +3; exit when it is at most -2. Orders execute at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Indicator initialization: SMA windows require their full history; EMA(12), EMA(26), and EMA(9) use SMA seeds; RSI(14) uses simple average gains/losses over the initial 14 changes; Bollinger uses population standard deviation
- Execution: next candle open; buy effective price is `open * 1.0015`, sell effective price is `open * 0.9985`; any remaining position is liquidated at the final close with sell cost
- Completed round trips: **3** (6 executions, including final liquidation)
- Entries: 2026-10-20 13:40 UTC at 81,862.620015 effective; 22:30 UTC at 83,161.345185; 2026-10-21 07:40 UTC at 83,160.023205
- Exits: 2026-10-20 19:25 UTC at 82,281.662095; 2026-10-21 02:15 UTC at 82,665.824985; final close at 83,459.143220 effective
- Net equity: **1,002.72 USDT**
- Net return after costs: **+0.27%**

The ensemble captured three long episodes and ended slightly above starting equity after costs, but it remained well below buy-and-hold for this one-day sample. This single historical observation is not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON and evaluated all five votes using only the completed close at each index. A long position was opened when the vote sum reached +3 or higher and closed when it reached -2 or lower, with the next candle open used for execution. The run produced six executions, no open position after final liquidation, and final equity **1002.7235951318439 USDT** before display rounding. No orders were submitted and no look-ahead data was used.
