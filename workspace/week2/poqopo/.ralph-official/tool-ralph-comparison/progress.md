# Official Ralph BTCUSDT 5m comparison progress

- Round: 10 of 10
- Scope: official Ralph loop only; custom Strategy Ralph artifacts under `poqopo/.ralph/` were not used or modified.
- Dataset: `poqopo/bitcoin-5m-24h.json` with `poqopo/bitcoin-5m-24h.metadata.json` (BTCUSDT, Binance, 5m, 288 candles, latest 24h metadata).
- Backtest conventions: completed-candle signals; next-open execution where a signal applies; 0.10% fee plus 0.05% adverse slippage per side; no look-ahead; no live trades; research only.

## Strategy coverage

1. Buy-and-hold — **verified in round 1** (`strategy-01-buy-and-hold.md`)
2. SMA crossover — **verified in round 2** (`strategy-02-sma-crossover.md`)
3. EMA crossover — **verified in round 3** (`strategy-03-ema-crossover.md`)
4. RSI mean reversion — **verified in round 4** (`strategy-04-rsi-mean-reversion.md`)
5. Bollinger Bands — **verified in round 5** (`strategy-05-bollinger-bands.md`)
6. Donchian breakout — **verified in round 6** (`strategy-06-donchian-breakout.md`)
7. Momentum plus volatility filter — **verified in round 7** (`strategy-07-momentum-volatility-filter.md`)
8. MACD crossover — **verified in round 8** (`strategy-08-macd-crossover.md`)
9. Grid trading — **verified in round 9** (`strategy-09-grid-trading.md`)
10. Signal ensemble — **verified in round 10** (`strategy-10-signal-ensemble.md`)

## Final verification

All ten strategy reports and `summary.md` are present under this comparison directory. The final ensemble backtest produced 3 completed round trips, 1,002.72 USDT net equity, and +0.27% after required costs. The comparison is complete after 10 official Ralph rounds.

Rounds 1–10 verified reproducible local Python backtests against the JSON. Round 9 used a fixed first-open reference grid with four 0.25%-spaced buy levels, 250 USDT tranches, and next-grid-level exits; strict crossings executed at the next open with required costs; two completed round trips ended at 1,000.18 USDT (+0.02%). Round 10 used a five-signal vote ensemble and ended at 1,002.72 USDT (+0.27%).
