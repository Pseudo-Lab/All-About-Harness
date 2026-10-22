# Iteration 7 — Momentum with Volatility Filter

## Data and reproducibility
- **Input only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT, Binance, 288 saved five-minute candles covering the latest-24-hour sample.
- **Script:** `.ralph/backtest_momentum_volatility_filter.py` (Python standard library; validates metadata candle count).
- Starting capital is normalized to 1.00 USDT-equivalent; long-only, unlevered, no shorting.

## Strategy and execution
- Entry signal after candle *i* closes: `close[i] > close[i-12]` (positive 12-bar momentum) **and** current 14-bar simple ATR divided by close is less than or equal to the median ATR/close of the preceding 20 completed candles (a relative low-volatility filter).
- Exit signal after candle *i* closes: `close[i] <= close[i-12]`.
- Signals use completed candles only and execute at candle *i+1* open. Any remaining position is forced out at the final candle close. The final-close exit is not used to generate another signal.

## Assumptions
- Fee: **0.10% per side**.
- Slippage: **0.05% adverse price impact per side** (buy = open × 1.0005; sell = open or final close × 0.9995).
- Costs apply on every entry and exit. No spread, funding, borrow, tax, latency, liquidity, or minimum-order model.

## Results
| Metric | Result |
|---|---:|
| Gross compounded trade return (before fees; raw execution prices) | **+0.762239%** |
| Net return after fees/slippage | **-1.628054%** |
| Final value per 1.00 | 0.98371946 |
| Trades (round trips) | 8 |
| Winning trades | 2 / 8 (25.00%) |
| Exposure | 37.50% of candles |
| Close-to-close max drawdown | **-2.024778%** |

Net trade returns were **-0.488248%, -0.033654%, +0.212042%, -0.408986%, -0.296446%, -0.303177%, -0.410419%, and +0.091487%**. The positive gross result did not cover modeled costs.

## Limitations and suitability
This is one 24-hour, 288-candle sample with only eight trades, so estimates have essentially no statistical power. The 12/14/20 parameters and long-only rules are a fixed, clearly defined specification, not out-of-sample validation or optimization. OHLC candles do not reveal intrabar path, spread, queue position, or exact next-open fills; ATR and median calculations are bar-based, and final-close liquidation is a convention. Results are sensitive to fees, slippage, and parameter choices. This strategy is **not suitable evidence for deployment or live trading** on this tiny sample. This is historical research only and does not establish future profitability.
