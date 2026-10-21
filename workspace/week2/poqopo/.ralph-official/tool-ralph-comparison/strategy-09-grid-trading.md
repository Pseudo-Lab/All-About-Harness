# Strategy 09 — Grid trading

## Round 9 result

Research-only long/flat grid strategy using a fixed reference and four 0.25% buy levels. Signals are evaluated only after a candle closes; orders execute at the following candle open. Starting equity: **1,000.00 USDT**.

- Dataset: `poqopo/bitcoin-5m-24h.json`, 288 completed 5-minute candles
- Window: 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC
- Grid definition: reference price is the first candle open, 81,577.01; buy levels are 0.25%, 0.50%, 0.75%, and 1.00% below reference; each level has one 250 USDT tranche; each filled level exits at the next grid level above it
- Signal: buy when a completed close crosses strictly down through an unused buy level; sell when a completed close crosses strictly up through the corresponding target; one position per level
- Execution: next candle open; buys use open * (1 + 0.0015), sells use open * (1 - 0.0015); any remaining position is liquidated at the final close with the sell cost
- Completed round trips: **2** (4 executions; no final liquidation was required)
- First entry: 2026-10-20 09:50 UTC at 81,495.040300 effective
- Final exit: 2026-10-20 12:25 UTC at 81,547.498650 effective
- Net equity: **1,000.18 USDT**
- Net return after costs: **+0.02%**

The grid completed two small round trips and ended slightly above the starting balance after costs. It was inactive after the last exit because price did not cross another configured buy level. Results are highly dependent on the chosen spacing and reference; this single 24-hour observation is not investment advice.

## Reproduction

A local Python standard-library backtest loaded the JSON and used the first candle open as the only initial reference. After each completed close, strict crossings were detected against the four fixed levels; eligible orders were executed at the next candle open, with at most one 250 USDT tranche held per level. Buys used `open * (1 + 0.0015)` and sells used `open * (1 - 0.0015)`. The backtest produced four executions (two buys and two sells), no open inventory at the end, and final equity **1000.1840130168318 USDT** before display rounding. No orders were submitted and no look-ahead data was used.
