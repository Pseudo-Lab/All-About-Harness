# Iteration 10 — 2-of-3 Signal Ensemble

## Data and reproducibility
- Inputs: `poqopo/bitcoin-5m-24h.json` and `poqopo/bitcoin-5m-24h.metadata.json` only.
- BTCUSDT Binance, 288 five-minute candles (latest 24 hours in the saved metadata).
- Script: `.ralph/backtest_ensemble.py` (Python standard library).
- Starting capital is normalized to 1.00 USDT-equivalent; long-only, unlevered, no shorting.

## Strategy and execution
At each completed candle, three independently defined signals are scored: (1) SMA(5) > SMA(20), (2) MACD(12,26) > its EMA(9) signal line, and (3) close > close 12 bars earlier. Enter when at least two are bullish and flat; exit when fewer than two remain bullish. Signals use candle *i* only and execute at candle *i+1* open. Any open position is liquidated at the final candle close. EMA seeds and all indicator windows use only historical/completed closes.

## Costs
Fee is **0.10% per side** and adverse slippage is **0.05% per side** (buy +0.05%, sell −0.05%). Costs apply on every entry and exit. No spread, latency, partial fills, funding, tax, liquidity, or order-size effects are modeled.

## Results
| Metric | Result |
|---|---:|
| Gross compounded trade return | **+1.153174%** |
| Net return after fee/slippage | **−2.131481%** |
| Final value per 1.00 | 0.97868519 |
| Round trips | 11 |
| Winning trades | 3 / 11 (27.27%) |
| Exposure | 52.777778% of candles |
| Close-to-close max drawdown | **−3.967024%** |

Trade summary: 11 round trips; the final trade was force-closed at the last close. A rerun produced the identical JSON SHA-256: `bcc6720ebf1656f3c85ad36f4a61ecf2e0ee0287edbe9e1d951f6d4a5f5343e5`.

## Limitations and conclusion
This is one 24-hour sample with only 11 trades and no out-of-sample validation; indicator periods and the 2-of-3 threshold are arbitrary and were not optimized here. OHLC candles cannot establish intrabar path, spread, queue position, or exact fills. Results are highly cost- and regime-sensitive. This ensemble is **not suitable evidence for deployment or live trading** and does not establish future profitability. Among the completed strategy reports, the buy-and-hold baseline had the strongest reported net result (+2.153853%); this ensemble was not the best historical performer for this sample. Research only; no trades or exchange access.
