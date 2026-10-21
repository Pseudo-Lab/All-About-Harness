# Iteration 8 — MACD Crossover

## Data and reproducibility
- **Inputs only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT, Binance, 288 saved five-minute candles (latest-24-hour sample).
- **Script:** `.ralph/backtest_macd_crossover.py` (Python standard library; validates metadata candle count).
- Starting capital is normalized to 1.00 USDT-equivalent; long-only, unlevered, no shorting.

## Strategy and execution
- MACD uses a 12-period EMA minus a 26-period EMA; the signal line is a 9-period EMA of MACD. EMA seeds are simple averages of their initial periods, then use the standard recursive EMA formula.
- Entry: after a completed candle, MACD crosses **above** its signal line.
- Exit: after a completed candle, MACD crosses **below** its signal line.
- Both signals use only completed closes and execute at the next candle open. Any remaining position is forced out at the final candle close; this close is not used to generate another signal.

## Assumptions
- Fee: **0.10% per side**.
- Slippage: **0.05% adverse price impact per side** (buy = open × 1.0005; sell = open or final close × 0.9995).
- Costs apply on every entry and exit. No spread, funding, borrow, tax, latency, liquidity, or minimum-order model.

## Results
| Metric | Result |
|---|---:|
| Gross compounded trade return (before fees; raw execution prices) | **+1.598046%** |
| Net return after fees/slippage | **-1.405617%** |
| Final value per 1.00 | 0.98594383 |
| Trades (round trips) | 10 |
| Winning trades | 3 / 10 (30.00%) |
| Exposure | 51.388889% of candles |
| Close-to-close max drawdown | **-2.804877%** |

Net trade returns were **-0.531780%, +1.285980%, -0.403240%, +0.001536%, -0.147377%, -0.440482%, -0.757551%, -0.378132%, +0.111667%, and -0.140933%**. The positive gross result did not cover modeled costs. Two independent runs produced identical output (SHA-256 `b07174f6676e559d45f4e7889da13e79c5e732ab2fefaf33e73496b0c237bf97`).

## Limitations and suitability
This is one 24-hour, 288-candle sample with only ten trades, so it has essentially no statistical power. The 12/26/9 parameters and long-only rules are a fixed specification, not out-of-sample validation or optimization. OHLC candles do not reveal intrabar path, spread, queue position, or exact next-open fills; EMA initialization and final-close liquidation are conventions. Results are sensitive to fees, slippage, and parameters. This strategy is **not suitable evidence for deployment or live trading** on this tiny sample. This is historical research only and does not establish future profitability.
