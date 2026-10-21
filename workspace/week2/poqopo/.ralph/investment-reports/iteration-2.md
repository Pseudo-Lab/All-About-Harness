# Iteration 2 — SMA Crossover

## Data and reproducibility
- **Input only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT Binance, 288 five-minute candles (2026-10-20 09:20 UTC through 2026-10-21 09:19:59.999 UTC).
- **Script:** `.ralph/backtest_sma_crossover.py` (Python standard library; validates metadata candle count).

## Strategy and execution
- Long-only **5-bar SMA / 20-bar SMA** crossover. A bullish cross is fast SMA moving from at/below slow SMA to above it; bearish is the reverse.
- The signal is computed only at a completed candle close. Entry or exit occurs at the **next candle open**, preventing look-ahead. Any open position is forced out at the final candle close.
- Starting capital is 1.00 USDT-equivalent; no leverage or shorting.

## Assumptions
- Fee: **0.10% per side**.
- Slippage: **0.05% adverse price impact per side** (buy open × 1.0005; sell open/close × 0.9995).
- Costs are applied on every entry and exit. No spread, funding, borrow, tax, order-size, latency, or liquidity model.

## Results
| Metric | Result |
|---|---:|
| Gross compounded trade return (before costs) | **+0.2733%** |
| Net return after fees/slippage | **−1.7132%** |
| Final value per 1.00 | 0.982868 |
| Trades (round trips) | 10 |
| Winning trades | 3 / 10 (30.0%) |
| Exposure | 52.43% of candles |
| Close-to-close max drawdown | **−3.7925%** |

The strategy generated many short-duration reversals; costs converted a slightly positive gross result into a net loss for this window.

## Limitations and suitability
This is one 24-hour, 288-candle sample, so the result has little statistical power and is sensitive to SMA lengths and the selected window. OHLC data cannot reproduce intrabar path, spread, queue position, or exact next-open fills. The final-close liquidation is a convention, not a guaranteed fill. This historical result does **not** imply future profitability and is **not suitable evidence for deployment**; it is only one comparable result in the ten-strategy research set.
