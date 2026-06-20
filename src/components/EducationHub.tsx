"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./EducationHub.module.css";

// --- Types ---
interface Candle {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

type LessonId = "candles" | "crossover" | "reversion" | "risk";
type Overlay = "none" | "dual-sma" | "mean";

interface Lesson {
  id: LessonId;
  title: string;
  tagline: string;
  body: string;
  overlay: Overlay;
  takeaways: string[];
  icon: ReactNode;
}

// --- Lesson content ---
const LESSONS: Lesson[] = [
  {
    id: "candles",
    title: "Reading Candlesticks",
    tagline: "The anatomy of a single bar",
    body: "Each candle packs four prices into one shape. The body spans the open and close; the thin wicks mark the high and low. Green means price closed higher than it opened (bullish); red means it closed lower (bearish). Watch the bars print one period at a time.",
    overlay: "none",
    takeaways: ["Body = open to close", "Wicks = high & low", "Green up, red down"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <line x1="5" y1="2" x2="5" y2="14" stroke="currentColor" strokeWidth="1.3" />
        <rect x="3" y="5" width="4" height="6" rx="1" fill="currentColor" />
        <line x1="11" y1="3" x2="11" y2="13" stroke="currentColor" strokeWidth="1.3" />
        <rect x="9" y="6" width="4" height="5" rx="1" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "crossover",
    title: "Moving Average Crossover",
    tagline: "Trend-following with two SMAs",
    body: "A simple moving average smooths price into a line. When a fast average crosses above a slow one, momentum is turning up — a classic buy trigger. The reverse cross signals an exit. Notice the blue (fast) and amber (slow) lines tracing out as candles appear.",
    overlay: "dual-sma",
    takeaways: ["Fast SMA reacts quickly", "Cross up = buy", "Cross down = sell"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2 11C4 11 5 5 8 5S12 9 14 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M2 8C4 8 5 10 8 10S12 4 14 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "reversion",
    title: "Mean Reversion",
    tagline: "Betting on the snap-back",
    body: "Mean-reversion strategies assume price stretches too far from its average and then snaps back. When price dips well below the mean (the center line), reversion traders buy, expecting a bounce. The further the stretch, the stronger the expected pull.",
    overlay: "mean",
    takeaways: ["Price orbits its mean", "Buy the dip below", "Sell into the overshoot"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2 2" />
        <path d="M2 8C4 3 5 13 8 8S12 3 14 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "risk",
    title: "Drawdown & Sharpe",
    tagline: "Returns are only half the story",
    body: "Two strategies can earn the same return while one is far riskier. Max drawdown measures the worst peak-to-trough drop you would have endured. The Sharpe ratio scores return per unit of volatility. A smooth equity curve beats a jagged ride to the same destination.",
    overlay: "none",
    takeaways: ["Drawdown = worst drop", "Sharpe = return / risk", "Smoother is stronger"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2L14 5V8C14 11.5 11.5 13.5 8 14.5C4.5 13.5 2 11.5 2 8V5L8 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
];

// --- Synthetic data (geometric brownian motion) ---
function boxMuller() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateCandles(count: number, drift: number, vol: number, start: number): Candle[] {
  const out: Candle[] = [];
  const dt = 1 / 252;
  let price = start;
  for (let i = 0; i < count; i++) {
    const d = (drift - 0.5 * vol * vol) * dt;
    const diff = vol * Math.sqrt(dt) * boxMuller();
    const next = price * Math.exp(d + diff);
    const intraday = vol * Math.sqrt(dt);
    const open = price;
    const close = next;
    const high = Math.max(open, close) * (1 + Math.abs(boxMuller()) * intraday * 0.5);
    const low = Math.min(open, close) * (1 - Math.abs(boxMuller()) * intraday * 0.5);
    out.push({ t: i, open, high, low, close });
    price = next;
  }
  return out;
}

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

// --- Chart geometry ---
const W = 760;
const H = 340;
const PAD = { top: 18, right: 14, bottom: 20, left: 14 };
const SPEEDS = [1, 2, 4];

export default function EducationHub() {
  const [lessonId, setLessonId] = useState<LessonId>("candles");
  const [data, setData] = useState<Candle[]>([]);
  const [visible, setVisible] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [hover, setHover] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const lesson = LESSONS.find((l) => l.id === lessonId)!;

  // Fresh data per lesson
  useEffect(() => {
    setData(generateCandles(90, 0.14, 0.3, 70));
    setVisible(0);
    setPlaying(true);
    setHover(null);
  }, [lessonId]);

  // Replay loop
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!playing || data.length === 0) return;
    timer.current = setInterval(() => {
      setVisible((v) => {
        if (v >= data.length) {
          setPlaying(false);
          return v;
        }
        return v + 1;
      });
    }, 200 / speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, data, speed]);

  const closes = useMemo(() => data.map((d) => d.close), [data]);
  const fastSma = useMemo(() => sma(closes, 7), [closes]);
  const slowSma = useMemo(() => sma(closes, 21), [closes]);
  const meanSma = useMemo(() => sma(closes, 20), [closes]);

  const { scaleX, scaleY, candleW } = useMemo(() => {
    if (data.length === 0) return { scaleX: () => 0, scaleY: () => 0, candleW: 6 };
    const maxP = Math.max(...data.map((d) => d.high));
    const minP = Math.min(...data.map((d) => d.low));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const step = innerW / data.length;
    return {
      candleW: Math.max(2.5, step * 0.6),
      scaleX: (i: number) => PAD.left + step * i + step / 2,
      scaleY: (p: number) => PAD.top + innerH * (1 - (p - minP) / (maxP - minP || 1)),
    };
  }, [data]);

  const linePath = (series: (number | null)[]) => {
    let d = "";
    for (let i = 0; i < Math.min(visible, data.length); i++) {
      const v = series[i];
      if (v === null || v === undefined) continue;
      const x = scaleX(i);
      const y = scaleY(v);
      d += d === "" ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return d;
  };

  const progress = data.length ? Math.min(visible / data.length, 1) : 0;
  const hovered = hover !== null ? data[hover] : null;

  const togglePlay = () => {
    if (visible >= data.length) setVisible(0);
    setPlaying((p) => !p);
  };
  const restart = () => {
    setVisible(0);
    setPlaying(true);
  };

  return (
    <section className={styles.hub} aria-label="Interactive trading lessons">
      <div className={styles.hubHeader}>
        <span className={styles.eyebrow}>Interactive</span>
        <h2 className={styles.hubTitle}>Learn by watching the market build itself</h2>
        <p className={styles.hubSub}>
          Pick a lesson and watch an animated, bar-by-bar replay. Hover any candle to inspect its open, high, low and close.
        </p>
      </div>

      <div className={styles.layout}>
        {/* Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHead}>
            <div>
              <h3 className={styles.chartTitle}>{lesson.title}</h3>
              <p className={styles.chartTagline}>{lesson.tagline}</p>
            </div>
            <div className={styles.controls}>
              <button className={styles.ctrlBtn} onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                {playing ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <rect x="3" y="2.5" width="2.5" height="9" rx="0.5" fill="currentColor" />
                    <rect x="8.5" y="2.5" width="2.5" height="9" rx="0.5" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M4 2.5L11 7L4 11.5V2.5Z" fill="currentColor" />
                  </svg>
                )}
              </button>
              <button className={styles.ctrlBtn} onClick={restart} aria-label="Restart">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M11.5 7A4.5 4.5 0 117 2.5V0.5L10 3L7 5.5V3.5A3.5 3.5 0 1010.5 7H11.5Z" fill="currentColor" />
                </svg>
              </button>
              <div className={styles.speeds}>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ""}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.chartBody}>
            <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} onMouseLeave={() => setHover(null)}>
              {/* Mean band overlay */}
              {lesson.overlay === "mean" && (
                <path d={linePath(meanSma)} fill="none" stroke="var(--accent-primary)" strokeWidth={1.6} strokeDasharray="4 3" strokeLinecap="round" opacity={0.85} />
              )}
              {/* Dual SMA overlay */}
              {lesson.overlay === "dual-sma" && (
                <>
                  <path d={linePath(slowSma)} fill="none" stroke="#f59e0b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
                  <path d={linePath(fastSma)} fill="none" stroke="var(--accent-primary)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </>
              )}

              {/* Candles */}
              {data.slice(0, visible).map((d, i) => {
                const up = d.close >= d.open;
                const color = up ? "var(--color-profit)" : "var(--color-loss)";
                const x = scaleX(i);
                const bodyTop = scaleY(Math.max(d.open, d.close));
                const bodyBottom = scaleY(Math.min(d.open, d.close));
                const bodyH = Math.max(1, bodyBottom - bodyTop);
                const isHover = hover === i;
                return (
                  <g key={i} className={styles.candle} onMouseEnter={() => setHover(i)}>
                    <rect x={x - candleW} y={PAD.top} width={candleW * 2} height={H - PAD.top - PAD.bottom} fill="transparent" />
                    <line x1={x} y1={scaleY(d.high)} x2={x} y2={scaleY(d.low)} stroke={color} strokeWidth={isHover ? 1.8 : 1} />
                    <rect
                      x={x - candleW / 2}
                      y={bodyTop}
                      width={candleW}
                      height={bodyH}
                      rx={1}
                      fill={color}
                      opacity={isHover ? 1 : 0.9}
                      stroke={isHover ? "var(--text-primary)" : "none"}
                      strokeWidth={isHover ? 0.8 : 0}
                    />
                  </g>
                );
              })}

              {/* Crosshair */}
              {hover !== null && hover < visible && (
                <line x1={scaleX(hover)} y1={PAD.top} x2={scaleX(hover)} y2={H - PAD.bottom} stroke="var(--border-hover)" strokeWidth={1} strokeDasharray="3 3" />
              )}
            </svg>

            {/* Tooltip */}
            {hovered && (
              <div className={styles.tooltip}>
                <div className={styles.tipRow}><span>O</span><span>{hovered.open.toFixed(2)}</span></div>
                <div className={styles.tipRow}><span>H</span><span>{hovered.high.toFixed(2)}</span></div>
                <div className={styles.tipRow}><span>L</span><span>{hovered.low.toFixed(2)}</span></div>
                <div className={styles.tipRow}>
                  <span>C</span>
                  <span className={hovered.close >= hovered.open ? "profit" : "loss"}>{hovered.close.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Legend for overlays */}
            {lesson.overlay === "dual-sma" && (
              <div className={styles.legend}>
                <span className={styles.legendItem}><i style={{ background: "var(--accent-primary)" }} /> Fast SMA (7)</span>
                <span className={styles.legendItem}><i style={{ background: "#f59e0b" }} /> Slow SMA (21)</span>
              </div>
            )}
            {lesson.overlay === "mean" && (
              <div className={styles.legend}>
                <span className={styles.legendItem}><i style={{ background: "var(--accent-primary)" }} /> Mean (20)</span>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className={styles.progressWrap}>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
            </div>
            <span className={styles.barCount}>
              {Math.min(visible, data.length)} / {data.length} bars
            </span>
          </div>
        </div>

        {/* Lesson selector + content */}
        <div className={styles.side}>
          <div className={styles.lessonList}>
            {LESSONS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLessonId(l.id)}
                className={`${styles.lessonBtn} ${l.id === lessonId ? styles.lessonActive : ""}`}
              >
                <span className={styles.lessonIcon}>{l.icon}</span>
                <span className={styles.lessonName}>{l.title}</span>
              </button>
            ))}
          </div>

          <div className={styles.lessonContent} key={lesson.id}>
            <p className={styles.lessonBody}>{lesson.body}</p>
            <div className={styles.takeaways}>
              {lesson.takeaways.map((t) => (
                <span key={t} className={styles.takeaway}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
