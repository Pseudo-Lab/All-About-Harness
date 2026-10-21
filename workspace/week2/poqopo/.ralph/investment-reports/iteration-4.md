# Iteration 4 — RSI Mean Reversion

## Data and reproducibility
- **Input only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT, Binance, 288 five-minute candles (latest 24-hour saved sample), 2026-10-20 09:20:00 UTC through 2026-10-21 09:19:59.999 UTC.
- **Script:** `.ralph/backtest_rsi_mean_reversion.py` (Python standard library; validates metadata candle count).
- RSI is the 14-bar Wilder RSI. The initial average gain/loss uses the first 14 close-to-close changes; subsequent values use Wilder smoothing. No future candle is used.

## Strategy and execution
- Long-only mean reversion: enter when completed-candle RSI is **at or below 30**; exit when completed-candle RSI is **at or above 70**.
- Signals are evaluated after candle close and orders execute at the **next candle open**. If still open, the position is liquidated at the final candle close. No leverage or shorting.
- Starting capital is normalized to 1.00 USDT-equivalent.

## Assumptions
- Fee: **0.10% per side**.
- Slippage: **0.05% adverse price impact per side** (buy = open × 1.0005; sell = open or final close × 0.9995).
- Costs apply on every entry and exit. No spread, funding, borrow, tax, latency, liquidity, or minimum-order model.

## Results
| Metric | Result |
|---|---:|
| Gross compounded trade return (before costs) | **0.000000%** |
| Net return after fees/slippage | **0.000000%** |
| Final value per 1.00 | 1.00000000 |
| Trades (round trips) | 0 |
| Winning trades | 0 / 0 (0.00%) |
| Exposure | 0.00% of candles |
| Close-to-close max drawdown | **0.000000%** |

No candle-close RSI reached the entry threshold, so the strategy generated no entries, no exits, and no modeled costs in this sample.

## Limitations and suitability
This is one 24-hour, 288-candle sample and produced no trades; therefore its zero return is not evidence of skill, safety, or profitability. RSI thresholds and period are arbitrary parameters and could materially change results. OHLC candles do not reveal intrabar path, spread, queue position, or exact next-open fills; final-close liquidation is a convention. The sample has no statistical power for estimating expectancy. This result is historical research only, is **not suitable evidence for deployment**, and cannot identify the best strategy overall among the ten without the remaining strategy backtests.
