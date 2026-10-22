# Iteration 1 — Buy-and-Hold Baseline

## Data and reproducibility
- **Input only:** `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json`.
- **Dataset:** BTCUSDT, Binance, 288 five-minute candles (2026-10-20 09:20:00 UTC through 2026-10-21 09:19:59.999 UTC).
- **Script:** `.ralph/backtest_buy_hold.py` (standard-library Python; validates the metadata candle count).

## Strategy and execution
- Buy once at the first candle's **open** and remain continuously long; sell at the final candle's **close**.
- The entry uses only the first open (no later candle information). The exit is placed only after the final candle closes, so no look-ahead is used.
- One round trip; 100% invested exposure between entry and exit.
- Starting capital is normalized to 1.00 USDT-equivalent.

## Assumptions
- Fee: **0.10% per side** (buy and sell).
- Slippage: **0.05% adverse price impact per side**; entry price is open × 1.0005 and exit price is close × 0.9995.
- Quantity and proceeds are fee-adjusted; no leverage, funding, borrowing, tax, spread model, or minimum-order constraints.

## Results
| Metric | Result |
|---|---:|
| First open | 81,577.01 |
| Final close | 83,584.52 |
| Gross return | **+2.4609%** |
| Net return after fees/slippage | **+2.1539%** |
| Final value per 1.00 | 1.02153853 |
| Close-to-close max drawdown | **−1.0636%** |
| Intrabar high-to-low max drawdown (descriptive) | **−1.4715%** |
| Trades | 1 buy + 1 sell |
| Exposure | 100% |

## Limitations and suitability
This is a single, overlapping 24-hour sample (288 candles), not an out-of-sample test. It has no statistical power to establish a durable edge, and the result is highly dependent on the chosen start/end window. OHLC candles cannot model execution path, spread, queue position, or intrabar stop behavior. The reported result is historical only: it does not imply future profitability and is **not suitable as evidence for deployment**. It is a baseline for comparison with the other nine strategies; this report alone cannot identify the overall best performer.
