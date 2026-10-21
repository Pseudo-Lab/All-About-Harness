# Iteration 9 — Fixed Grid Trading Simulation

## Data and reproducibility
- **Inputs only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT, Binance, 288 saved five-minute candles.
- **Script:** `.ralph/backtest_grid_trading.py` (Python standard library; validates metadata candle count).
- Starting capital is normalized to 1.00 USDT-equivalent; long-only, unlevered, no shorting.

## Strategy and execution
- At the first candle open, establish a static arithmetic grid anchored to that known price. Four equal-capital buy rungs are 0.25%, 0.50%, 0.75%, and 1.00% below the anchor.
- Each filled buy has a resting sell limit one grid spacing (0.25% of anchor) above its buy level. After a sale, that slot may buy again at its original level. No shorting and no leverage.
- Resting orders are evaluated against each candle’s OHLC. A limit is considered filled when the candle low/high touches it. Because OHLC does not reveal path, exits are processed before entries if both sides are touched in one candle. Any remaining position is liquidated at the final close.
- Orders are known before each candle; no future candle information is used to create or move levels.

## Assumptions
- Fee: **0.10% per side**.
- Slippage: **0.05% adverse price impact per side** (buy = level × 1.0005; sell = level/final close × 0.9995).
- Costs apply on every entry and exit. No spread, queue position, partial fills, funding, tax, latency, liquidity, or minimum-order model.

## Results
| Metric | Result |
|---|---:|
| Gross compounded grid return (before costs) | **+1.006281%** |
| Net return after fees/slippage | **-0.049775%** |
| Final value per 1.00 | 0.99950225 |
| Round trips | 4 |
| Winning trades | 0 / 4 (0.00%) |
| Exposure | 3.819444% of candles |
| Close-to-close max drawdown | **-0.089521%** |

All four completed trades used the first rung (entry bars 3, 33, 50, and 51; exit bars 9, 36, 51, and 52). Each net trade return was approximately **-0.049775%**: the 0.25% grid capture was smaller than the modeled round-trip costs. Two independent runs produced identical output (SHA-256 `ca41796957881449082495fe792888bef251be22ff1a68ec1478729d99ff5f32`).

## Limitations and suitability
This is one 24-hour, 288-candle sample with only four round trips and very low exposure, so it has essentially no statistical power. Static grid spacing and four-rung sizing are one arbitrary specification, not optimization or validation. OHLC data cannot establish intrabar order, queue position, spread, or actual limit fills; the exit-before-entry tie-break is a convention. Results are highly sensitive to grid spacing and transaction costs. This strategy is **not suitable evidence for deployment or live trading** on this tiny sample. This is historical research only and does not establish future profitability.
