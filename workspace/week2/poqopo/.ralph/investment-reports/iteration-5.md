# Iteration 5 — Bollinger Bands Mean Reversion

## Data and reproducibility
- **Input only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT, Binance, 288 five-minute candles (saved latest-24-hour sample), 2026-10-20 09:20:00 UTC through 2026-10-21 09:19:59.999 UTC.
- **Script:** `.ralph/backtest_bollinger_mean_reversion.py` (Python standard library; validates metadata candle count).
- Bollinger Bands use a 20-completed-close simple moving average and population standard deviation, with bands at ±2 standard deviations.

## Strategy and execution
- Long-only mean reversion: enter when a completed candle close is **at or below the lower band**; exit when a completed candle close is **at or above the middle band (20-bar SMA)**.
- Signals are evaluated after candle close and orders execute at the **next candle open**. Any remaining position is liquidated at the final candle close. No leverage or shorting.
- Starting capital is normalized to 1.00 USDT-equivalent.

## Assumptions
- Fee: **0.10% per side**.
- Slippage: **0.05% adverse price impact per side** (buy = open × 1.0005; sell = open or final close × 0.9995).
- Costs apply on every entry and exit. No spread, funding, borrow, tax, latency, liquidity, or minimum-order model.

## Results
| Metric | Result |
|---|---:|
| Gross compounded trade return (before fees; raw open/close prices) | **+0.864755%** |
| Net return after fees/slippage | **-0.338788%** |
| Final value per 1.00 | 0.99661212 |
| Trades (round trips) | 4 |
| Winning trades | 1 / 4 (25.00%) |
| Exposure | 12.50% of candles |
| Close-to-close max drawdown | **-0.661884%** |

Trade net returns were **-0.084188%, -0.278732%, +0.104755%, and -0.080686%**. Three of four round trips lost after modeled costs; the gross edge was too small to overcome fees and slippage.

## Limitations and suitability
This is one 24-hour, 288-candle sample and only four trades, so metrics have essentially no statistical power. Parameters (20 bars, ±2 standard deviations, and the middle-band exit) are arbitrary and were not optimized out of sample. OHLC candles do not reveal intrabar path, spread, queue position, or exact next-open fills; final-close liquidation is a convention. The backtest is historical research only, does **not** establish future profitability, and is not suitable evidence for deployment. It cannot identify the best performer among all ten strategies until the remaining strategy reports are complete.
