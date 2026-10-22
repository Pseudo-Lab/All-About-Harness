# Backtest Progress

## Objective
Using only the saved Binance BTCUSDT 5-minute, latest-24-hour dataset, backtest ten clearly defined strategies without look-ahead bias, state fee/slippage assumptions, record metrics and limitations, and compare historical performance for this sample. Research only; no trades or exchange access.

## Criteria
- Read and use the local JSON and metadata files only.
- Define signal and execution timing explicitly; avoid look-ahead.
- Include reproducible calculations, costs, metrics, exposure/trade summary, and limitations.
- Produce one report per strategy and eventually compare all ten.

## Completed work
- Iteration 1 completed: buy-and-hold baseline.
- Inputs verified: 288 candles and metadata candleCount=288.
- Added reproducible standard-library script: `.ralph/backtest_buy_hold.py`.
- Added report: `.ralph/investment-reports/iteration-1.md`.
- Execution model: first candle open entry, final candle close exit; 0.10% fee and 0.05% slippage per side.

## Latest test results
`python3 .ralph/backtest_buy_hold.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross return: +2.460877%
- Net return: +2.153853%
- Close-to-close max drawdown: -1.063574%
- Intrabar high/low descriptive max drawdown: -1.471482%
- One round trip; 100% exposure.

## Iteration 2 completed: SMA crossover
- Added reproducible standard-library script: `.ralph/backtest_sma_crossover.py`.
- Added report: `.ralph/investment-reports/iteration-2.md`.
- Strategy: long-only 5-bar SMA / 20-bar SMA crossover; completed-close signal, next-candle-open execution, final-close forced exit.
- Costs: 0.10% fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_sma_crossover.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross compounded trade return: +0.273328%
- Net return after fees/slippage: -1.713200%
- Close-to-close max drawdown: -3.792518%
- 10 round trips; 3 winners (30.0%); 52.430556% exposure.

## Iteration 3 completed: EMA crossover
- Added reproducible standard-library script: `.ralph/backtest_ema_crossover.py`.
- Added report: `.ralph/investment-reports/iteration-3.md`.
- Strategy: long-only 5-bar EMA / 20-bar EMA crossover; completed-close signal, next-candle-open execution, final-close forced exit.
- EMA initialization: period SMA seed, then recursive EMA using only available completed closes.
- Costs: 0.10% fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_ema_crossover.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross compounded trade return: -0.513539%
- Net return after fees/slippage: -2.679412%
- Close-to-close max drawdown: -3.628702%
- 11 round trips; 3 winners (27.27%); 54.166667% exposure.

## Iteration 4 completed: RSI mean reversion
- Added reproducible standard-library script: `.ralph/backtest_rsi_mean_reversion.py`.
- Added report: `.ralph/investment-reports/iteration-4.md`.
- Strategy: long-only 14-bar Wilder RSI; enter at RSI <= 30 and exit at RSI >= 70; completed-close signal, next-candle-open execution, final-close forced exit.
- Costs: 0.10% fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_rsi_mean_reversion.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross return: 0.000000%
- Net return after fees/slippage: 0.000000%
- Close-to-close max drawdown: 0.000000%
- 0 round trips; 0.00% exposure; no RSI entry signal occurred.

## Iteration 5 completed: Bollinger Bands mean reversion
- Added reproducible standard-library script: `.ralph/backtest_bollinger_mean_reversion.py`.
- Added report: `.ralph/investment-reports/iteration-5.md`.
- Strategy: long-only 20-bar SMA Bollinger Bands with ±2 population standard deviations; enter on completed close at/below lower band and exit on completed close at/above middle band; next-candle-open execution and final-close forced exit.
- Costs: 0.10% fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_bollinger_mean_reversion.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross compounded trade return: +0.864755%
- Net return after fees/slippage: -0.338788%
- Final value per 1.00: 0.99661212
- Close-to-close max drawdown: -0.661884%
- 4 round trips; 1 winner (25.00%); 12.50% exposure.
- Deterministic rerun matched the same metrics and trade count.

## Iteration 6 completed: Donchian breakout
- Added reproducible standard-library script: `.ralph/backtest_donchian_breakout.py`.
- Added report: `.ralph/investment-reports/iteration-6.md`.
- Strategy: long-only 20-bar Donchian entry (completed close strictly above preceding 20 highs) with 10-bar low exit (completed close strictly below preceding 10 lows); next-candle-open execution and final-close forced exit.
- Channels exclude the signal candle; signals therefore use only information available before the trade.
- Costs: 0.10% adverse fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_donchian_breakout.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross compounded trade return: +0.271554%
- Net return after fees/slippage: -1.812880%
- Final value per 1.00: 0.98187120
- Close-to-close max drawdown: -3.098061%
- 7 round trips; 2 winners (28.57%); 37.847222% exposure.
- Deterministic rerun matched the same metrics and trade count.

## Remaining work
- Completed strategies 7 through 10 using the same dataset and documented cost/timing conventions.
- Aggregated metrics and identified the best historical performer within this sample only.
- Preserve limitations and do not infer future profitability.

## Iteration 7 completed: Momentum with volatility filter
- Added reproducible standard-library script: `.ralph/backtest_momentum_volatility_filter.py`.
- Added report: `.ralph/investment-reports/iteration-7.md`.
- Strategy: long-only positive 12-bar momentum (`close > close 12 bars earlier`) gated by current 14-bar ATR/close being at or below the median ATR/close of the preceding 20 completed bars; exit when 12-bar momentum is non-positive.
- Signals are evaluated on completed candles and filled at the next candle open; final candle close is a forced exit.
- Costs: 0.10% adverse fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_momentum_volatility_filter.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross compounded trade return: +0.762239%
- Net return after fees/slippage: -1.628054%
- Final value per 1.00: 0.98371946
- Close-to-close max drawdown: -2.024778%
- 8 round trips; 2 winners (25.00%); 37.50% exposure.
- Deterministic rerun produced identical SHA-256 output (`5455f4a54e95371a7d4e71537b1b5b8b4e5f0df27a5ead311dc9638d083ae792`).

## Remaining work
- Completed strategies 9 through 10 using the same dataset and documented cost/timing conventions.
- Aggregated metrics and identified the best historical performer within this sample only.
- Preserve limitations and do not infer future profitability.

## Iteration 8 completed: MACD crossover
- Added reproducible standard-library script: `.ralph/backtest_macd_crossover.py`.
- Added report: `.ralph/investment-reports/iteration-8.md`.
- Strategy: long-only 12/26 MACD with 9-period signal-line crossover; completed-close signal, next-candle-open execution, final-close forced exit.
- Costs: 0.10% adverse fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_macd_crossover.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross compounded trade return: +1.598046%
- Net return after fees/slippage: -1.405617%
- Final value per 1.00: 0.98594383
- Close-to-close max drawdown: -2.804877%
- 10 round trips; 3 winners (30.00%); 51.388889% exposure.
- Deterministic rerun produced identical SHA-256 output (`b07174f6676e559d45f4e7889da13e79c5e732ab2fefaf33e73496b0c237bf97`).

## Remaining work
- Completed strategies 9 through 10 using the same dataset and documented cost/timing conventions.
- Aggregated metrics and identified the best historical performer within this sample only.
- Preserve limitations and do not infer future profitability.

## Iteration 9 completed: Fixed grid trading simulation
- Added reproducible standard-library script: `.ralph/backtest_grid_trading.py`.
- Added report: `.ralph/investment-reports/iteration-9.md`.
- Strategy: static four-rung long-only grid anchored at the first candle open; buy limits at 0.25%, 0.50%, 0.75%, and 1.00% below anchor; each filled rung sells one spacing above its buy level and can repeat.
- Resting OHLC limit fills use only the current candle's observed range; exits are processed before entries on same-candle ambiguity; final close forces liquidation.
- Costs: 0.10% adverse fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_grid_trading.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully.
- Gross compounded grid return: +1.006281%
- Net return after fees/slippage: -0.049775%
- Final value per 1.00: 0.99950225
- Close-to-close max drawdown: -0.089521%
- 4 round trips; 0 winners (0.00%); 3.819444% exposure.
- Deterministic rerun produced identical SHA-256 output (`ca41796957881449082495fe792888bef251be22ff1a68ec1478729d99ff5f32`).

## Remaining work
- Completed strategy 10 using the same dataset and documented cost/timing conventions.
- Aggregated metrics and identified the best historical performer within this sample only.
- Preserve limitations and do not infer future profitability.

## Iteration 10 completed: 2-of-3 signal ensemble
- Added reproducible standard-library script: `.ralph/backtest_ensemble.py`.
- Added report: `.ralph/investment-reports/iteration-10.md`.
- Strategy: long-only ensemble entering when at least two of SMA(5)>SMA(20), MACD(12,26)>signal(9), and 12-bar positive momentum are true; exits below two.
- Signals use completed closes and execute next-candle open; final close forces liquidation.
- Costs: 0.10% adverse fee and 0.05% adverse slippage per side.

## Latest test results
`python3 .ralph/backtest_ensemble.py poqopo/bitcoin-5m-24h.json poqopo/bitcoin-5m-24h.metadata.json` completed successfully twice.
- Gross compounded trade return: +1.153174%
- Net return after fees/slippage: -2.131481%
- Final value per 1.00: 0.97868519
- Close-to-close max drawdown: -3.967024%
- 11 round trips; 3 winners (27.27%); 52.777778% exposure.
- Deterministic rerun matched SHA-256 `bcc6720ebf1656f3c85ad36f4a61ecf2e0ee0287edbe9e1d951f6d4a5f5343e5`.

## Overall comparison note
Across the ten completed reports, the buy-and-hold baseline has the strongest reported net result (+2.153853%) for this sample. This is descriptive historical comparison only and is not evidence of future profitability.

## Final verification — no remaining work
- Aggregated and compared all ten reports in `.ralph/investment-summary.md`.
- Parsed local JSON successfully: 288 candles, matching metadata `candleCount=288`.
- Verified exactly ten strategy reports exist under `.ralph/investment-reports/`.
- Final comparison winner by reported net return after common modeled costs: buy-and-hold, +2.153853%.
- Sharpe-like metric was not invented because reports do not provide a common periodic equity/return series.
- Limitations preserved; no future profitability claim.

## Blockers
None. All requested files and comparisons were verified.
