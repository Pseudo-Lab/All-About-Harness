# Iteration 6 — Donchian Breakout

## Data and reproducibility
- **Input only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT, Binance, 288 five-minute candles from the saved latest-24-hour sample (2026-10-20 09:20:00 UTC through 2026-10-21 09:19:59.999 UTC).
- **Script:** `.ralph/backtest_donchian_breakout.py` (Python standard library; validates metadata candle count).
- Starting capital is normalized to 1.00 USDT-equivalent; long-only, unlevered, no shorting.

## Strategy and execution
- Entry: after a candle closes, go long if its close is **strictly above the highest high of the preceding 20 completed candles**.
- Exit: after a candle closes, exit if its close is **strictly below the lowest low of the preceding 10 completed candles** (a 20/10 Donchian-style breakout/trailing exit).
- Signals use only information available before the signal candle's close. Orders execute at the **next candle open**. A remaining position is liquidated at the final candle close.
- Channel windows intentionally exclude the signal candle, avoiding look-ahead from its high/low.

## Assumptions
- Fee: **0.10% per side**.
- Slippage: **0.05% adverse price impact per side** (buy = open × 1.0005; sell = open or final close × 0.9995).
- Costs apply on every entry and exit. No spread, funding, borrow, tax, latency, liquidity, or minimum-order model.

## Results
| Metric | Result |
|---|---:|
| Gross compounded trade return (before fees; raw open/close prices) | **+0.271554%** |
| Net return after fees/slippage | **-1.812880%** |
| Final value per 1.00 | 0.98187120 |
| Trades (round trips) | 7 |
| Winning trades | 2 / 7 (28.57%) |
| Exposure | 37.85% of candles |
| Close-to-close max drawdown | **-3.098061%** |

Trade net returns were **-0.612168%, +0.236521%, -0.563693%, -0.001571%, -0.633962%, -0.528729%, and +0.281659%**. The small positive gross result did not cover the modeled round-trip costs.

## Limitations and suitability
This is one 24-hour, 288-candle sample with only seven trades, so performance estimates have essentially no statistical power. The 20/10 parameters were selected as a standard definition, not validated or optimized out of sample. OHLC candles do not reveal intrabar path, spread, queue position, or exact next-open fills; final-close liquidation is a convention. The result is sensitive to fees, slippage, and parameter choices. This is historical research only, does **not** establish future profitability, and is not suitable evidence for deployment or live trading.
