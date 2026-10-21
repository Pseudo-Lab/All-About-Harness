# Investment Research Summary — BTCUSDT 5-Minute Sample

## Executive summary

I verified the saved Binance BTCUSDT dataset (`poqopo/bitcoin-5m-24h.json` plus metadata) and all ten reports in `.ralph/investment-reports/`. The sample contains 288 five-minute candles covering one saved 24-hour window. Every report uses completed-candle signals with next-candle-open execution (except the explicitly defined buy-and-hold/grid conventions), and reports a 0.10% fee plus 0.05% adverse slippage per side.

On the reported, cost-adjusted net return, **buy-and-hold is the best historical performer in this sample: +2.153853%**, with a reported close-to-close maximum drawdown of -1.063574% and 100% exposure. This is a descriptive in-sample result, not a recommendation or forecast.

## Comparison

| # | Strategy | Net return after costs | Reported max drawdown | Round trips | Exposure | Simple Sharpe-like measure |
|---:|---|---:|---:|---:|---:|---|
| 1 | Buy-and-hold baseline | **+2.153853%** | -1.063574% close-to-close | 1 | 100.00% | N/A: no periodic return series |
| 2 | Fixed grid trading | -0.049775% | -0.089521% close-to-close | 4 | 3.819444% | N/A: no periodic return series |
| 3 | Bollinger mean reversion | -0.338788% | -0.661884% close-to-close | 4 | 12.50% | N/A: no periodic return series |
| 4 | MACD crossover | -1.405617% | -2.804877% close-to-close | 10 | 51.388889% | N/A: no periodic return series |
| 5 | Momentum + volatility filter | -1.628054% | -2.024778% close-to-close | 8 | 37.50% | N/A: no periodic return series |
| 6 | SMA crossover | -1.713200% | -3.792518% close-to-close | 10 | 52.430556% | N/A: no periodic return series |
| 7 | Donchian breakout | -1.812880% | -3.098061% close-to-close | 7 | 37.847222% | N/A: no periodic return series |
| 8 | 2-of-3 signal ensemble | -2.131481% | -3.967024% close-to-close | 11 | 52.777778% | N/A: no periodic return series |
| 9 | EMA crossover | -2.679412% | -3.628702% close-to-close | 11 | 54.166667% | N/A: no periodic return series |
| 10 | RSI mean reversion | 0.000000% | 0.000000% | 0 | 0.00% | N/A: no periodic return series |

The ranking above is by reported net return after modeled costs. The reports do not provide a common candle-by-candle equity/return series, so a genuine Sharpe-like statistic cannot be recomputed without inventing data. I therefore mark it unavailable rather than manufacture risk-adjusted results.

## Selected historical winner and runner-ups

- **Winner for this saved sample: buy-and-hold**, +2.153853% net.
- **Runner-up by net return: fixed grid**, -0.049775% net; its low drawdown and low exposure do not offset its negative return and only four round trips.
- **Third: Bollinger mean reversion**, -0.338788% net, 12.50% exposure and four round trips.

No strategy other than buy-and-hold produced a positive net return after the common modeled costs. Because the sample is one short window and risk-adjusted return series are unavailable, this winner should not be interpreted as the most robust strategy.

## Common assumptions and timing

- Input was restricted to the saved local BTCUSDT Binance 5-minute JSON and metadata; metadata states 288 candles.
- Starting capital was normalized to 1.00, long-only, unlevered, and no shorting.
- Fee: 0.10% per side; adverse slippage: 0.05% per side. Costs apply on every modeled entry and exit.
- Indicator signals are computed only from completed candles and executed at the next candle open; open positions are forced out at the final close.
- Buy-and-hold enters at the first candle open and exits at the final close. The grid uses predeclared levels and an explicit exit-before-entry tie-break for OHLC ambiguity.
- No spread, latency, queue position, partial fills, funding, borrowing, taxes, liquidity limits, minimum order sizes, or exchange execution guarantees are modeled.

## Caveats and limitations

1. This is a single 24-hour, 288-candle in-sample window. It has little or no statistical power and is highly dependent on the selected period and parameters.
2. OHLC candles do not reveal intrabar price paths, so next-open and resting-limit fills are simplified; grid fills especially depend on an arbitrary OHLC tie-break.
3. Reported drawdowns are not perfectly uniform: buy-and-hold additionally reports an intrabar descriptive drawdown, while the comparison uses its close-to-close figure; other reports generally provide close-to-close drawdown. This prevents stronger apples-to-apples risk ranking.
4. No report supplied a common periodic equity curve, so Sharpe-like/risk-adjusted statistics cannot be independently verified. Trade counts and exposure are informative but not substitutes for a risk-adjusted distribution.
5. Parameters were fixed specifications, not validated out of sample. Zero trades for RSI means zero modeled return, not evidence of safety or skill.
6. Historical backtest results do not establish future profitability and do not account for regime changes or real execution costs.

**This is research only, not financial advice, and it is not a prediction of future returns. No trades were placed.**
