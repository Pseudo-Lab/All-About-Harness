# BTCUSDT 5-minute strategy comparison

## Scope and controls

Official Ralph comparison using only `poqopo/bitcoin-5m-24h.json` and its metadata: BTCUSDT/Binance, 288 completed 5-minute candles from 2026-10-20 09:20 UTC through 2026-10-21 09:15 UTC. Every strategy is research-only, uses completed-candle signals and next-open execution where applicable, applies 0.10% fee plus 0.05% adverse slippage per side, avoids look-ahead, and submits no trades.

## Results

| # | Strategy | Round trips | Net equity (USDT) | Net return |
|---:|---|---:|---:|---:|
| 1 | Buy-and-hold | 1 | 1,021.54 | +2.15% |
| 2 | SMA crossover | 6 | 997.86 | -0.21% |
| 3 | EMA crossover | 2 | 1,012.27 | +1.23% |
| 4 | RSI mean reversion | 0 | 1,000.00 | 0.00% |
| 5 | Bollinger Bands | 4 | 996.62 | -0.34% |
| 6 | Donchian breakout | 6 | 990.83 | -0.92% |
| 7 | Momentum + volatility filter | 17 | 962.86 | -3.71% |
| 8 | MACD crossover | 10 | 985.95 | -1.40% |
| 9 | Grid trading | 2 | 1,000.18 | +0.02% |
| 10 | Signal ensemble | 3 | 1,002.72 | +0.27% |

## Conclusion

Buy-and-hold was the strongest result in this single rising 24-hour sample. EMA crossover was the strongest actively timed strategy; the ensemble was modestly positive but did not beat passive exposure. High-turnover strategies suffered from whipsaws and required execution costs. These results are descriptive backtest observations only, not evidence of durable edge or investment advice.

Each row is reproducible from its corresponding `strategy-*.md` report and the unchanged local dataset. No live orders or trades were made.
