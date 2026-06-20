// Strategy signal engine — evaluates the latest BUY / SELL / HOLD signal from a
// series of closing prices. Shared by the live paper-trading auto-trader.

export type StrategyId = "sma_crossover" | "rsi" | "bollinger" | "macd";
export type Signal = "BUY" | "SELL" | "HOLD";

export interface StrategyParams {
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  period?: number;
  oversold?: number;
  overbought?: number;
  stdDev?: number;
  stopLoss?: number;
  takeProfit?: number;
}

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period < 1) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period < 1 || values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsiSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    const g = ch >= 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function rollingStd(
  values: number[],
  means: (number | null)[],
  period: number
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const mean = means[i];
    if (mean == null) continue;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += (values[j] - mean) ** 2;
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

// Compute the BUY / SELL / HOLD signal at every bar in the series. Uses the
// exact same indicator math and cross-detection rules as evaluateSignal, but
// returns a full array so the backtest engine can replay the strategy bar by
// bar over historical data. Index 0..n-1 aligns with `closes`.
export function computeSignalSeries(
  closes: number[],
  strategy: StrategyId,
  params: StrategyParams = {}
): Signal[] {
  const n = closes.length;
  const out: Signal[] = new Array(n).fill("HOLD");
  if (n < 3) return out;

  if (strategy === "sma_crossover" || strategy === "macd") {
    const fastP = (params.fastPeriod ?? (strategy === "macd" ? 12 : 9)) | 0;
    const slowP = (params.slowPeriod ?? (strategy === "macd" ? 26 : 21)) | 0;
    const fast = strategy === "macd" ? ema(closes, fastP) : sma(closes, fastP);
    const slow = strategy === "macd" ? ema(closes, slowP) : sma(closes, slowP);
    for (let i = 1; i < n; i++) {
      const f0 = fast[i - 1], s0 = slow[i - 1], f1 = fast[i], s1 = slow[i];
      if (f0 == null || s0 == null || f1 == null || s1 == null) continue;
      if (f0 <= s0 && f1 > s1) out[i] = "BUY";
      else if (f0 >= s0 && f1 < s1) out[i] = "SELL";
    }
    return out;
  }

  if (strategy === "rsi") {
    const period = (params.period ?? 14) | 0;
    const oversold = params.oversold ?? 30;
    const overbought = params.overbought ?? 70;
    const r = rsiSeries(closes, period);
    for (let i = 1; i < n; i++) {
      const r0 = r[i - 1], r1 = r[i];
      if (r0 == null || r1 == null) continue;
      if (r0 <= oversold && r1 > oversold) out[i] = "BUY";
      else if (r0 >= overbought && r1 < overbought) out[i] = "SELL";
    }
    return out;
  }

  if (strategy === "bollinger") {
    const period = (params.period ?? 20) | 0;
    const mult = params.stdDev ?? 2;
    const mid = sma(closes, period);
    const std = rollingStd(closes, mid, period);
    for (let i = 1; i < n; i++) {
      const m0 = mid[i - 1], d0 = std[i - 1], m1 = mid[i], d1 = std[i];
      const lower0 = m0 != null && d0 != null ? m0 - mult * d0 : null;
      const lower1 = m1 != null && d1 != null ? m1 - mult * d1 : null;
      const upper0 = m0 != null && d0 != null ? m0 + mult * d0 : null;
      const upper1 = m1 != null && d1 != null ? m1 + mult * d1 : null;
      if (lower1 != null && lower0 != null && closes[i - 1] >= lower0 && closes[i] < lower1) out[i] = "BUY";
      else if (upper1 != null && upper0 != null && closes[i - 1] <= upper0 && closes[i] > upper1) out[i] = "SELL";
    }
    return out;
  }

  return out;
}

// Evaluate the signal at the most recent candle (cross detected on last bar).
export function evaluateSignal(
  closes: number[],
  strategy: StrategyId,
  params: StrategyParams = {}
): Signal {
  const n = closes.length;
  if (n < 3) return "HOLD";
  const i = n - 1;

  if (strategy === "sma_crossover" || strategy === "macd") {
    const fastP = (params.fastPeriod ?? (strategy === "macd" ? 12 : 9)) | 0;
    const slowP = (params.slowPeriod ?? (strategy === "macd" ? 26 : 21)) | 0;
    const fast = strategy === "macd" ? ema(closes, fastP) : sma(closes, fastP);
    const slow = strategy === "macd" ? ema(closes, slowP) : sma(closes, slowP);
    const f0 = fast[i - 1];
    const s0 = slow[i - 1];
    const f1 = fast[i];
    const s1 = slow[i];
    if (f0 == null || s0 == null || f1 == null || s1 == null) return "HOLD";
    if (f0 <= s0 && f1 > s1) return "BUY";
    if (f0 >= s0 && f1 < s1) return "SELL";
    return "HOLD";
  }

  if (strategy === "rsi") {
    const period = (params.period ?? 14) | 0;
    const oversold = params.oversold ?? 30;
    const overbought = params.overbought ?? 70;
    const r = rsiSeries(closes, period);
    const r0 = r[i - 1];
    const r1 = r[i];
    if (r0 == null || r1 == null) return "HOLD";
    if (r0 <= oversold && r1 > oversold) return "BUY";
    if (r0 >= overbought && r1 < overbought) return "SELL";
    return "HOLD";
  }

  if (strategy === "bollinger") {
    const period = (params.period ?? 20) | 0;
    const mult = params.stdDev ?? 2;
    const mid = sma(closes, period);
    const std = rollingStd(closes, mid, period);
    const lower0 = mid[i - 1] != null && std[i - 1] != null ? (mid[i - 1] as number) - mult * (std[i - 1] as number) : null;
    const lower1 = mid[i] != null && std[i] != null ? (mid[i] as number) - mult * (std[i] as number) : null;
    const upper0 = mid[i - 1] != null && std[i - 1] != null ? (mid[i - 1] as number) + mult * (std[i - 1] as number) : null;
    const upper1 = mid[i] != null && std[i] != null ? (mid[i] as number) + mult * (std[i] as number) : null;
    if (lower1 != null && lower0 != null && closes[i - 1] >= lower0 && closes[i] < lower1) return "BUY";
    if (upper1 != null && upper0 != null && closes[i - 1] <= upper0 && closes[i] > upper1) return "SELL";
    return "HOLD";
  }

  return "HOLD";
}
