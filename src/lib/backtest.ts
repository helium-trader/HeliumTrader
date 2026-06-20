import { computeSignalSeries, type StrategyId, type StrategyParams } from "@/lib/strategy";
import type { Candle } from "@/lib/stock";

export interface BacktestTrade {
  id: number;
  entryIndex: number;
  exitIndex: number;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number; // % return on the position
  pnlValue: number; // $ return on the position
  exitReason: "signal" | "stop-loss" | "take-profit" | "end-of-data";
  profit: boolean;
}

export interface EquityPoint {
  time: string;
  equity: number;
}

export interface BacktestMetrics {
  totalReturn: number; // % compounded over all trades
  finalEquity: number;
  winRate: number; // %
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number; // gross profit / gross loss; -1 = no losing trades (∞)
  maxDrawdown: number; // %
  avgWin: number; // %
  avgLoss: number; // %
  bestTrade: number; // %
  worstTrade: number; // %
  avgHoldBars: number;
  sharpe: number; // simple per-trade Sharpe proxy
}

export interface BacktestResult {
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  metrics: BacktestMetrics;
}

export interface BacktestOptions {
  startingEquity?: number;
  // Risk controls expressed in percent (e.g. 2 means 2%). 0/undefined disables.
  stopLoss?: number;
  takeProfit?: number;
  // Optional fallback strategy applied when price is below switchThreshold.
  switchEnabled?: boolean;
  switchThreshold?: number;
  switchStrategy?: StrategyId;
}

/**
 * Run a long-only, one-position-at-a-time backtest over historical candles
 * using the shared strategy signal engine. Enters on BUY, exits on SELL or
 * when a stop-loss / take-profit threshold is breached intrabar. Fully
 * invested per trade so percentage returns compound into the equity curve.
 */
export function runBacktest(
  candles: Candle[],
  strategy: StrategyId,
  params: StrategyParams = {},
  opts: BacktestOptions = {}
): BacktestResult {
  const startingEquity = opts.startingEquity ?? 100000;
  const closes = candles.map((c) => c.close);
  const n = candles.length;

  const primary = computeSignalSeries(closes, strategy, params);

  // Apply fallback-strategy switching with the same rule the chart uses:
  // below the threshold, defer to the secondary strategy's signals.
  let signals = primary;
  if (
    opts.switchEnabled &&
    opts.switchThreshold != null &&
    opts.switchStrategy &&
    opts.switchStrategy !== strategy
  ) {
    const secondary = computeSignalSeries(closes, opts.switchStrategy, params);
    signals = primary.map((s, i) =>
      closes[i] < (opts.switchThreshold as number) ? secondary[i] : s
    );
  }

  const stopLossPct = opts.stopLoss && opts.stopLoss > 0 ? opts.stopLoss / 100 : 0;
  const takeProfitPct = opts.takeProfit && opts.takeProfit > 0 ? opts.takeProfit / 100 : 0;

  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];
  let equity = startingEquity;
  let peakEquity = startingEquity;
  let maxDrawdown = 0;
  let id = 1;

  let inPosition = false;
  let entryIndex = 0;
  let entryPrice = 0;

  const closeTrade = (exitIndex: number, exitPrice: number, reason: BacktestTrade["exitReason"]) => {
    const pnlPct = round(((exitPrice - entryPrice) / entryPrice) * 100);
    const pnlValue = equity * (pnlPct / 100);
    equity += pnlValue;
    if (equity > peakEquity) peakEquity = equity;
    const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;

    trades.push({
      id: id++,
      entryIndex,
      exitIndex,
      entryTime: candles[entryIndex].time,
      exitTime: candles[exitIndex].time,
      entryPrice: round(entryPrice),
      exitPrice: round(exitPrice),
      pnlPct,
      pnlValue: round(pnlValue),
      exitReason: reason,
      profit: pnlPct >= 0,
    });
    inPosition = false;
  };

  for (let i = 0; i < n; i++) {
    const candle = candles[i];

    if (inPosition) {
      // Check intrabar stop-loss / take-profit using the bar's low/high.
      const stopPrice = stopLossPct ? entryPrice * (1 - stopLossPct) : null;
      const tpPrice = takeProfitPct ? entryPrice * (1 + takeProfitPct) : null;

      if (stopPrice != null && candle.low <= stopPrice) {
        closeTrade(i, stopPrice, "stop-loss");
      } else if (tpPrice != null && candle.high >= tpPrice) {
        closeTrade(i, tpPrice, "take-profit");
      } else if (signals[i] === "SELL") {
        closeTrade(i, candle.close, "signal");
      }
    } else if (signals[i] === "BUY") {
      inPosition = true;
      entryIndex = i;
      entryPrice = candle.close;
    }

    equityCurve.push({ time: candle.time, equity: Number(equity.toFixed(2)) });
  }

  // Close any open position at the last bar so metrics reflect realized P&L.
  if (inPosition && n > 0) {
    closeTrade(n - 1, candles[n - 1].close, "end-of-data");
    if (equityCurve.length) {
      equityCurve[equityCurve.length - 1].equity = Number(equity.toFixed(2));
    }
  }

  return {
    trades,
    equityCurve,
    metrics: computeMetrics(trades, startingEquity, equity, maxDrawdown),
  };
}

function computeMetrics(
  trades: BacktestTrade[],
  startingEquity: number,
  finalEquity: number,
  maxDrawdown: number
): BacktestMetrics {
  const pnls = trades.map((t) => t.pnlPct);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

  const totalReturn = ((finalEquity - startingEquity) / startingEquity) * 100;

  const mean = pnls.length ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
  const variance = pnls.length
    ? pnls.reduce((a, b) => a + (b - mean) ** 2, 0) / pnls.length
    : 0;
  const std = Math.sqrt(variance);
  // Guard against floating-point noise inflating Sharpe when returns are
  // effectively identical (std ~ 0). Require a meaningful spread first.
  const sharpe = std > 1e-6 ? (mean / std) * Math.sqrt(pnls.length) : 0;

  const totalHold = trades.reduce((a, t) => a + (t.exitIndex - t.entryIndex), 0);

  // profitFactor uses -1 as a JSON-safe sentinel for "no losses" (Infinity is
  // not valid JSON); the UI renders this as the infinity symbol.
  const profitFactor =
    grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? -1 : 0;

  return {
    totalReturn: round(totalReturn),
    finalEquity: Number(finalEquity.toFixed(2)),
    winRate: pnls.length ? round((wins.length / pnls.length) * 100) : 0,
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    profitFactor,
    maxDrawdown: round(maxDrawdown),
    avgWin: wins.length ? round(grossProfit / wins.length) : 0,
    avgLoss: losses.length ? round(grossLoss / losses.length) : 0,
    bestTrade: pnls.length ? round(Math.max(...pnls)) : 0,
    worstTrade: pnls.length ? round(Math.min(...pnls)) : 0,
    avgHoldBars: trades.length ? Math.round(totalHold / trades.length) : 0,
    sharpe: round(sharpe),
  };
}

function round(n: number): number {
  return Number(n.toFixed(2));
}
