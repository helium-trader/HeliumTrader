"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  t: number;
}

interface SimulatedChartProps {
  timeframe: string;
  basePrice?: number;
  /** Change this value to force a brand-new random series. */
  regenKey?: number;
  /** Strategy id used to draw the algorithm overlay. */
  strategy?: string;
  /** When true, draw the algorithm overlay (indicators + signals). */
  showAlgo?: boolean;
  /** Current strategy parameters (periods, thresholds, etc.). */
  params?: Record<string, number>;
  /** When provided, render these exact candles instead of generating random data. */
  staticCandles?: Candle[];
  /** Accessible label for the chart. */
  ariaLabel?: string;
  /** Enable switching to a fallback strategy when price drops below a threshold. */
  switchEnabled?: boolean;
  /** Price level below which the fallback strategy takes over. */
  switchThreshold?: number;
  /** Fallback strategy id used when price is below the threshold. */
  switchStrategy?: string;
}

const NUM_CANDLES = 64;

const timeframeMinutes: Record<string, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1H": 60,
  "4H": 240,
  "1D": 1440,
};

// Volatility per candle, scaled by timeframe (longer frames swing more)
const timeframeVol: Record<string, number> = {
  "1m": 0.0015,
  "5m": 0.0028,
  "15m": 0.0045,
  "1H": 0.0075,
  "4H": 0.013,
  "1D": 0.022,
};

function makeCandle(prevClose: number, vol: number, t: number): Candle {
  const open = prevClose;
  const drift = (Math.random() - 0.5) * 2 * vol;
  const close = Math.max(open * (1 + drift), 0.0001);
  const wick = open * vol * (0.4 + Math.random() * 1.1);
  const high = Math.max(open, close) + wick * Math.random();
  const low = Math.min(open, close) - wick * Math.random();
  const body = Math.abs(close - open) / (open || 1);
  const volume = (0.4 + Math.random() + body * 30) * 1000;
  return { open, high, low, close, volume, t };
}

function generateSeries(base: number, timeframe: string): Candle[] {
  const vol = timeframeVol[timeframe] ?? 0.007;
  const stepMs = (timeframeMinutes[timeframe] ?? 60) * 60_000;
  const now = Date.now();
  const candles: Candle[] = [];
  let prev = base;
  for (let i = 0; i < NUM_CANDLES; i++) {
    const t = now - (NUM_CANDLES - 1 - i) * stepMs;
    const c = makeCandle(prev, vol, t);
    candles.push(c);
    prev = c.close;
  }
  return candles;
}

function formatAxisTime(t: number, timeframe: string): string {
  const d = new Date(t);
  const mins = timeframeMinutes[timeframe] ?? 60;
  if (mins >= 1440) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ── Indicator helpers ──
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

function rollingStd(values: number[], means: (number | null)[], period: number): (number | null)[] {
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

interface OverlayLine {
  points: string;
  color: string;
  width: number;
  dash?: string;
  opacity?: number;
}
interface Marker {
  x: number;
  y: number;
  side: "buy" | "sell";
}

interface StrategyComputed {
  lines: { values: (number | null)[]; color: string; width: number; dash?: string; opacity?: number }[];
  signals: { i: number; side: "buy" | "sell" }[];
  band: { upper: (number | null)[]; lower: (number | null)[] } | null;
  legend: { label: string; color: string }[];
}

// Compute indicator lines, bands, and buy/sell signals for a single strategy.
function computeStrategy(
  strategy: string,
  closes: number[],
  params: Record<string, number>
): StrategyComputed {
  const lines: StrategyComputed["lines"] = [];
  const signals: { i: number; side: "buy" | "sell" }[] = [];
  let band: StrategyComputed["band"] = null;
  let legend: { label: string; color: string }[] = [];

  if (strategy === "sma_crossover" || strategy === "macd") {
    const fastP = (params.fastPeriod ?? (strategy === "macd" ? 12 : 9)) | 0;
    const slowP = (params.slowPeriod ?? (strategy === "macd" ? 26 : 21)) | 0;
    const fast = strategy === "macd" ? ema(closes, fastP) : sma(closes, fastP);
    const slow = strategy === "macd" ? ema(closes, slowP) : sma(closes, slowP);
    lines.push({ values: fast, color: "#38bdf8", width: 2 });
    lines.push({ values: slow, color: "#f59e0b", width: 2 });
    legend = [
      { label: `Fast (${fastP})`, color: "#38bdf8" },
      { label: `Slow (${slowP})`, color: "#f59e0b" },
    ];
    for (let i = 1; i < closes.length; i++) {
      const f0 = fast[i - 1];
      const s0 = slow[i - 1];
      const f1 = fast[i];
      const s1 = slow[i];
      if (f0 == null || s0 == null || f1 == null || s1 == null) continue;
      if (f0 <= s0 && f1 > s1) signals.push({ i, side: "buy" });
      else if (f0 >= s0 && f1 < s1) signals.push({ i, side: "sell" });
    }
  } else if (strategy === "bollinger") {
    const period = (params.period ?? 20) | 0;
    const mult = params.stdDev ?? 2;
    const mid = sma(closes, period);
    const std = rollingStd(closes, mid, period);
    const upper = mid.map((m, i) => (m == null || std[i] == null ? null : m + mult * (std[i] as number)));
    const lower = mid.map((m, i) => (m == null || std[i] == null ? null : m - mult * (std[i] as number)));
    band = { upper, lower };
    lines.push({ values: mid, color: "#f59e0b", width: 1.5, dash: "5 4" });
    legend = [{ label: `Bands (${period}, ${mult}σ)`, color: "#38bdf8" }];
    for (let i = 1; i < closes.length; i++) {
      const lo = lower[i];
      const up = upper[i];
      if (lo == null || up == null) continue;
      if (closes[i - 1] >= (lower[i - 1] ?? lo) && closes[i] < lo) signals.push({ i, side: "buy" });
      else if (closes[i - 1] <= (upper[i - 1] ?? up) && closes[i] > up) signals.push({ i, side: "sell" });
    }
  } else if (strategy === "rsi") {
    const period = (params.period ?? 14) | 0;
    const oversold = params.oversold ?? 30;
    const overbought = params.overbought ?? 70;
    const r = rsiSeries(closes, period);
    lines.push({ values: sma(closes, period), color: "#38bdf8", width: 1.5, dash: "5 4" });
    legend = [{ label: `RSI (${period}) ${oversold}/${overbought}`, color: "#38bdf8" }];
    for (let i = 1; i < r.length; i++) {
      const r0 = r[i - 1];
      const r1 = r[i];
      if (r0 == null || r1 == null) continue;
      if (r0 <= oversold && r1 > oversold) signals.push({ i, side: "buy" });
      else if (r0 >= overbought && r1 < overbought) signals.push({ i, side: "sell" });
    }
  }

  return { lines, signals, band, legend };
}

function SimulatedChart({
  timeframe,
  basePrice = 3.847,
  regenKey = 0,
  strategy = "sma_crossover",
  showAlgo = false,
  params = {},
  staticCandles,
  ariaLabel = "Simulated price chart",
  switchEnabled = false,
  switchThreshold,
  switchStrategy = "rsi",
}: SimulatedChartProps) {
  const isStatic = !!staticCandles;
  const [candles, setCandles] = useState<Candle[]>(
    () => staticCandles ?? generateSeries(basePrice, timeframe)
  );
  const baseRef = useRef(basePrice);

  // Sync to externally provided candles (real market data)
  useEffect(() => {
    if (staticCandles) setCandles(staticCandles);
  }, [staticCandles]);

  // Regenerate when the timeframe changes
  useEffect(() => {
    if (isStatic) return;
    setCandles(generateSeries(baseRef.current, timeframe));
  }, [timeframe, isStatic]);

  // Regenerate a fresh series on demand (New Data button)
  useEffect(() => {
    if (isStatic || regenKey === 0) return;
    setCandles(generateSeries(baseRef.current, timeframe));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenKey]);

  // Live-update: nudge the last candle, periodically roll in a new one
  useEffect(() => {
    if (isStatic) return;
    const vol = timeframeVol[timeframe] ?? 0.007;
    const stepMs = (timeframeMinutes[timeframe] ?? 60) * 60_000;
    let ticks = 0;
    const id = setInterval(() => {
      ticks++;
      setCandles((prev) => {
        const next = prev.slice();
        const last = { ...next[next.length - 1] };
        const drift = (Math.random() - 0.5) * 2 * vol * 0.6;
        last.close = Math.max(last.close * (1 + drift), 0.0001);
        last.high = Math.max(last.high, last.close);
        last.low = Math.min(last.low, last.close);
        last.volume += Math.random() * 200;
        next[next.length - 1] = last;
        baseRef.current = last.close;
        // roll a fresh candle in every ~5 ticks
        if (ticks % 5 === 0) {
          next.shift();
          next.push(makeCandle(last.close, vol, last.t + stepMs));
        }
        return next;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [timeframe, isStatic]);

  // Compute strategy overlay (indicator lines, bands, and buy/sell markers).
  // When the switcher is active, the fallback strategy takes over for any
  // candle whose close is below the threshold.
  const algo = useMemo(() => {
    if (!showAlgo) return null;
    const closes = candles.map((c) => c.close);
    const primary = computeStrategy(strategy, closes, params);

    const switchActive =
      switchEnabled && switchThreshold != null && switchStrategy !== strategy;

    if (!switchActive) {
      return {
        lines: primary.lines,
        signals: primary.signals,
        band: primary.band,
        legend: primary.legend,
        threshold: null as number | null,
      };
    }

    const secondary = computeStrategy(switchStrategy, closes, params);
    const below = (i: number) => closes[i] < (switchThreshold as number);

    // Active strategy at each candle decides which signals are valid.
    const signals = [
      ...primary.signals.filter((s) => !below(s.i)),
      ...secondary.signals.filter((s) => below(s.i)),
    ].sort((a, b) => a.i - b.i);

    // Only draw each strategy's indicator lines where it is the active one:
    // primary above the threshold, fallback below it. Inactive points become
    // null so the line breaks instead of overlapping the other strategy.
    const maskLine = (values: (number | null)[], showWhenBelow: boolean) =>
      values.map((v, i) => (below(i) === showWhenBelow ? v : null));

    const lines = [
      ...primary.lines.map((l) => ({ ...l, values: maskLine(l.values, false) })),
      ...secondary.lines.map((l) => ({ ...l, values: maskLine(l.values, true) })),
    ];

    // Only the active strategy's band should be shown per region.
    const band = primary.band
      ? {
          upper: primary.band.upper.map((v, i) => (below(i) ? null : v)),
          lower: primary.band.lower.map((v, i) => (below(i) ? null : v)),
        }
      : null;

    const legend = [
      ...primary.legend,
      ...secondary.legend.map((l) => ({ ...l, label: `↓ ${l.label}` })),
    ];

    return { lines, signals, band, legend, threshold: switchThreshold as number };
  }, [showAlgo, strategy, params, candles, switchEnabled, switchThreshold, switchStrategy]);

  const view = useMemo(() => {
    const W = 1000;
    const H = 520;
    const padRight = 64;
    const padTop = 16;
    const volH = 88;
    const volGap = 14;
    const priceH = H - padTop - volH - volGap;
    const plotW = W - padRight;

    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    let max = Math.max(...highs);
    let min = Math.min(...lows);
    // Include overlay band extremes so bands stay in view
    if (algo?.band) {
      for (const u of algo.band.upper) if (u != null && u > max) max = u;
      for (const l of algo.band.lower) if (l != null && l < min) min = l;
    }
    // Keep the switch threshold line within view
    if (algo?.threshold != null) {
      if (algo.threshold > max) max = algo.threshold;
      if (algo.threshold < min) min = algo.threshold;
    }
    const pad = (max - min) * 0.08 || max * 0.02;
    max += pad;
    min -= pad;
    const range = max - min || 1;
    const maxVol = Math.max(...candles.map((c) => c.volume)) || 1;

    const slot = plotW / candles.length;
    const bodyW = Math.max(slot * 0.6, 2);

    const yPrice = (p: number) => padTop + (1 - (p - min) / range) * priceH;
    const yVol = (v: number) => padTop + priceH + volGap + (1 - v / maxVol) * volH;
    const xAt = (i: number) => i * slot + slot / 2;

    const decimals = max < 1 ? 4 : max < 100 ? 3 : 2;

    const gridLines = Array.from({ length: 6 }, (_, i) => {
      const p = min + (range * i) / 5;
      return { y: yPrice(p), label: p.toFixed(decimals) };
    });

    const tickEvery = Math.floor(candles.length / 6);
    const timeLabels = candles
      .map((c, i) => ({ i, c }))
      .filter(({ i }) => i % tickEvery === 0)
      .map(({ i, c }) => ({ x: xAt(i), label: formatAxisTime(c.t, timeframe) }));

    const last = candles[candles.length - 1];
    const lastUp = last.close >= last.open;

    // Build overlay geometry
    const toPath = (values: (number | null)[]) => {
      let d = "";
      let started = false;
      values.forEach((v, i) => {
        if (v == null) {
          started = false;
          return;
        }
        const cmd = started ? "L" : "M";
        d += `${cmd}${xAt(i).toFixed(1)},${yPrice(v).toFixed(1)} `;
        started = true;
      });
      return d.trim();
    };

    const overlayLines: OverlayLine[] = (algo?.lines ?? []).map((l) => ({
      points: toPath(l.values),
      color: l.color,
      width: l.width,
      dash: l.dash,
      opacity: l.opacity,
    }));

    let bandUpperPath = "";
    let bandLowerPath = "";
    let bandArea = "";
    if (algo?.band) {
      bandUpperPath = toPath(algo.band.upper);
      bandLowerPath = toPath(algo.band.lower);
      // Closed area between upper and lower (only where both defined)
      const idxs = algo.band.upper
        .map((u, i) => ({ u, l: algo.band!.lower[i], i }))
        .filter((p) => p.u != null && p.l != null);
      if (idxs.length > 1) {
        let d = "";
        idxs.forEach((p, k) => {
          d += `${k === 0 ? "M" : "L"}${xAt(p.i).toFixed(1)},${yPrice(p.u as number).toFixed(1)} `;
        });
        for (let k = idxs.length - 1; k >= 0; k--) {
          const p = idxs[k];
          d += `L${xAt(p.i).toFixed(1)},${yPrice(p.l as number).toFixed(1)} `;
        }
        bandArea = d.trim() + " Z";
      }
    }

    const markers: Marker[] = (algo?.signals ?? []).map((s) => {
      const c = candles[s.i];
      return {
        x: xAt(s.i),
        y: s.side === "buy" ? yPrice(c.low) + 16 : yPrice(c.high) - 16,
        side: s.side,
      };
    });

    // Switch threshold line + shaded "fallback" zone below it
    let thresholdY: number | null = null;
    let thresholdLabel = "";
    if (algo?.threshold != null) {
      thresholdY = yPrice(algo.threshold);
      thresholdLabel = algo.threshold.toFixed(decimals);
    }
    const priceBottom = padTop + priceH;

    return {
      W, H, padRight, padTop, priceH, volH, volGap, plotW, slot, bodyW,
      yPrice, yVol, gridLines, timeLabels, last, lastUp, decimals, min, max,
      overlayLines, bandUpperPath, bandLowerPath, bandArea, markers,
      thresholdY, thresholdLabel, priceBottom,
    };
  }, [candles, timeframe, algo]);

  const up = "#22c55e";
  const down = "#ef4444";

  return (
    <svg
      viewBox={`0 0 ${view.W} ${view.H}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      role="img"
      aria-label={ariaLabel}
      style={{ display: "block" }}
    >
      {/* horizontal grid lines + price labels */}
      {view.gridLines.map((g, i) => (
        <g key={`grid-${i}`}>
          <line x1={0} y1={g.y} x2={view.plotW} y2={g.y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <text
            x={view.W - view.padRight + 8}
            y={g.y + 3}
            fill="rgba(255,255,255,0.4)"
            fontSize={11}
            fontFamily="monospace"
          >
            {g.label}
          </text>
        </g>
      ))}

      {/* Switch threshold: shaded fallback zone below the threshold price */}
      {view.thresholdY != null && (
        <g>
          <rect
            x={0}
            y={view.thresholdY}
            width={view.plotW}
            height={Math.max(view.priceBottom - view.thresholdY, 0)}
            fill="rgba(239,68,68,0.08)"
          />
          <line
            x1={0}
            y1={view.thresholdY}
            x2={view.plotW}
            y2={view.thresholdY}
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            opacity={0.85}
          />
          <rect
            x={view.W - view.padRight}
            y={view.thresholdY - 9}
            width={view.padRight}
            height={18}
            fill="#ef4444"
          />
          <text
            x={view.W - view.padRight + 8}
            y={view.thresholdY + 3}
            fill="#0a0e17"
            fontSize={11}
            fontWeight={700}
            fontFamily="monospace"
          >
            {view.thresholdLabel}
          </text>
        </g>
      )}

      {/* Bollinger band area + edges (drawn behind candles) */}
      {view.bandArea && <path d={view.bandArea} fill="rgba(56,189,248,0.07)" stroke="none" />}
      {view.bandUpperPath && (
        <path d={view.bandUpperPath} fill="none" stroke="#38bdf8" strokeWidth={1.5} opacity={0.8} />
      )}
      {view.bandLowerPath && (
        <path d={view.bandLowerPath} fill="none" stroke="#38bdf8" strokeWidth={1.5} opacity={0.8} />
      )}

      {/* candles */}
      {candles.map((c, i) => {
        const x = i * view.slot + view.slot / 2;
        const isUp = c.close >= c.open;
        const color = isUp ? up : down;
        const bodyTop = view.yPrice(Math.max(c.open, c.close));
        const bodyBottom = view.yPrice(Math.min(c.open, c.close));
        const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
        return (
          <g key={`c-${i}`}>
            <line x1={x} y1={view.yPrice(c.high)} x2={x} y2={view.yPrice(c.low)} stroke={color} strokeWidth={1} />
            <rect x={x - view.bodyW / 2} y={bodyTop} width={view.bodyW} height={bodyHeight} fill={color} />
          </g>
        );
      })}

      {/* strategy indicator lines */}
      {view.overlayLines.map((l, i) => (
        <path
          key={`ov-${i}`}
          d={l.points}
          fill="none"
          stroke={l.color}
          strokeWidth={l.width}
          strokeDasharray={l.dash}
          strokeOpacity={l.opacity ?? 1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* buy / sell signal markers */}
      {view.markers.map((m, i) => {
        const s = 7;
        const tri =
          m.side === "buy"
            ? `${m.x},${m.y - s} ${m.x - s},${m.y + s} ${m.x + s},${m.y + s}`
            : `${m.x},${m.y + s} ${m.x - s},${m.y - s} ${m.x + s},${m.y - s}`;
        return (
          <polygon
            key={`m-${i}`}
            points={tri}
            fill={m.side === "buy" ? up : down}
            stroke="#0a0e17"
            strokeWidth={1}
          />
        );
      })}

      {/* volume bars */}
      {candles.map((c, i) => {
        const x = i * view.slot + view.slot / 2;
        const isUp = c.close >= c.open;
        const color = isUp ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)";
        const y = view.yVol(c.volume);
        const base = view.padTop + view.priceH + view.volGap + view.volH;
        return (
          <rect
            key={`v-${i}`}
            x={x - view.bodyW / 2}
            y={y}
            width={view.bodyW}
            height={Math.max(base - y, 0.5)}
            fill={color}
          />
        );
      })}

      {/* current price line */}
      <line
        x1={0}
        y1={view.yPrice(view.last.close)}
        x2={view.plotW}
        y2={view.yPrice(view.last.close)}
        stroke={view.lastUp ? up : down}
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.7}
      />
      <rect
        x={view.W - view.padRight}
        y={view.yPrice(view.last.close) - 9}
        width={view.padRight}
        height={18}
        fill={view.lastUp ? up : down}
      />
      <text
        x={view.W - view.padRight + 8}
        y={view.yPrice(view.last.close) + 3}
        fill="#0a0e17"
        fontSize={11}
        fontWeight={700}
        fontFamily="monospace"
      >
        {view.last.close.toFixed(view.decimals)}
      </text>

      {/* legend for the active overlay */}
      {showAlgo && algo && algo.legend.length > 0 && (
        <g>
          {algo.legend.map((lg, i) => (
            <g key={`lg-${i}`} transform={`translate(12, ${20 + i * 16})`}>
              <rect x={0} y={-8} width={10} height={3} rx={1} fill={lg.color} />
              <text x={16} y={-4} fill="rgba(255,255,255,0.7)" fontSize={11} fontFamily="monospace">
                {lg.label}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* time axis labels */}
      {view.timeLabels.map((t, i) => (
        <text
          key={`t-${i}`}
          x={t.x}
          y={view.H - 4}
          fill="rgba(255,255,255,0.4)"
          fontSize={11}
          fontFamily="monospace"
          textAnchor="middle"
        >
          {t.label}
        </text>
      ))}
    </svg>
  );
}

export default memo(SimulatedChart);
