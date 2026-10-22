# Iteration 3 — EMA Crossover

## Data and reproducibility
- **Input only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT, Binance, 288 five-minute candles; 2026-10-20 09:20:00 UTC through 2026-10-21 09:19:59.999 UTC.
- **Script:** `.ralph/backtest_ema_crossover.py` (Python standard library; validates metadata candle count).
- EMA values are seeded with their respective period SMA (5 and 20 closes), then updated recursively using only closes through the current completed candle.

## Strategy and execution
- Long-only **5-bar EMA / 20-bar EMA** crossover. Enter when the fast EMA crosses from at/below the slow EMA to above it; exit when it crosses from at/above to below.
- Signals are calculated only after candle close. Orders execute at the **next candle open**, so the signal candle's close is never used as a fill. Any open position is liquidated at the final candle close.
- Starting capital is normalized to 1.00 USDT-equivalent; no leverage or shorting.

## Assumptions
- Fee: **0.10% per side**.
- Slippage: **0.05% adverse price impact per side** (buy price = open × 1.0005; sell price = open or final close × 0.9995).
- Costs apply at every entry and exit. No spread, funding, borrow, tax, latency, liquidity, or minimum-order model.

## Results
| Metric | Result |
|---|---:|
| Gross compounded trade return (before costs) | **−0.513539%** |
| Net return after fees/slippage | **−2.679412%** |
| Final value per 1.00 | 0.97320588 |
| Trades (round trips) | 11 |
| Winning trades | 3 / 11 (27.27%) |
| Exposure | 54.17% of candles |
| Close-to-close max drawdown | **−3.628702%** |

The strategy had 8 losing and 3 winning round trips; modeled costs further reduced the already negative gross result.

## Limitations and suitability
This is one 24-hour, 288-candle sample, so it has little statistical power and is sensitive to EMA periods and the selected window. OHLC candles cannot model intrabar path, spread, queue position, or exact next-open fills; final-close liquidation is a convention. The result is historical only, does not imply future profitability, and is **not suitable evidence for deployment**. It is one result in the ten-strategy research set, not a conclusion about the best strategy overall.
