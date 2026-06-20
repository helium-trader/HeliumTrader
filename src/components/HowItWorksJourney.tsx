"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  animate,
} from "framer-motion";
import styles from "./HowItWorksJourney.module.css";

/* ---------------- helpers ---------------- */

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

function Copy({
  num,
  title,
  body,
  tags,
}: {
  num: string;
  title: string;
  body: string;
  tags: string[];
}) {
  return (
    <motion.div
      className={styles.copy}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
    >
      <span className={styles.copyEyebrow}>
        <span className={styles.copyEyebrowNum}>{num}</span>
        Step {num}
      </span>
      <h3 className={styles.copyTitle}>{title}</h3>
      <p className={styles.copyText}>{body}</p>
      <div className={styles.copyTags}>
        {tags.map((t) => (
          <span className={styles.tag} key={t}>
            {t}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------------- Step 1: data source ---------------- */

function DataSourceMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [live, setLive] = useState(false);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    if (!inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setLive(true), 500));

    const target = "AAPL";
    target.split("").forEach((_, i) => {
      timers.push(
        setTimeout(() => setTyped(target.slice(0, i + 1)), 1100 + i * 180)
      );
    });
    timers.push(setTimeout(() => setPhase("loading"), 1100 + target.length * 180 + 200));
    timers.push(setTimeout(() => setPhase("done"), 1100 + target.length * 180 + 1300));

    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div className={styles.glass} ref={ref}>
      <div className={styles.glassBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.glassBarLabel}>data source</span>
      </div>

      <div className={styles.toggleWrap}>
        <div>
          <p className={styles.fieldLabel}>Market Mode</p>
          <div className={styles.toggle}>
            <motion.span
              className={styles.toggleThumb}
              animate={{ left: live ? "50%" : "4px" }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            />
            <span
              className={`${styles.toggleOpt} ${!live ? styles.toggleOptActive : ""}`}
            >
              Sandbox
            </span>
            <span
              className={`${styles.toggleOpt} ${live ? styles.toggleOptActive : ""}`}
            >
              Live Market
            </span>
          </div>
        </div>

        {live && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <p className={styles.fieldLabel}>Ticker</p>
            <div className={styles.tickerField}>
              <span className={styles.tickerSymbol}>
                {typed}
                {phase === "idle" && <span className={styles.caret} />}
              </span>
              {phase === "loading" && <span className={styles.shimmer} />}
              {phase === "done" && (
                <motion.span
                  className={styles.tickerPrice}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 20 }}
                >
                  $198.42
                </motion.span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Step 2: strategies ---------------- */

const STRATS = [
  { name: "SMA Crossover", desc: "Trend following" },
  { name: "RSI Mean Reversion", desc: "Momentum bounce" },
  { name: "MACD", desc: "Signal divergence" },
  { name: "Bollinger Bands", desc: "Volatility breakout" },
];

function StrategyMockup() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className={styles.glass} ref={ref}>
      <div className={styles.glassBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.glassBarLabel}>strategy library</span>
      </div>

      <div className={styles.stratList}>
        {STRATS.map((s, i) => (
          <motion.div
            key={s.name}
            className={`${styles.stratCard} ${i === 0 ? styles.stratCardActive : ""}`}
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: i * 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.stratIcon}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 14l4-4 3 3 4-6 3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className={styles.stratMeta}>
              <span className={styles.stratName}>{s.name}</span>
              <span className={styles.stratDesc}>{s.desc}</span>
            </span>
            {i === 0 && (
              <motion.span
                className={styles.stratCheck}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7, type: "spring", stiffness: 300, damping: 18 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6 10l2.5 2.5L14 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Step 3: backtest chart ---------------- */

const CANDLES = [
  { o: 60, c: 80, h: 88, l: 54 },
  { o: 80, c: 72, h: 90, l: 66 },
  { o: 72, c: 96, h: 102, l: 70 },
  { o: 96, c: 110, h: 118, l: 92 },
  { o: 110, c: 100, h: 116, l: 94 },
  { o: 100, c: 124, h: 130, l: 98 },
  { o: 124, c: 116, h: 132, l: 112 },
  { o: 116, c: 142, h: 150, l: 114 },
  { o: 142, c: 134, h: 152, l: 128 },
  { o: 134, c: 158, h: 166, l: 130 },
  { o: 158, c: 148, h: 168, l: 144 },
  { o: 148, c: 176, h: 184, l: 146 },
];
const CHART_W = 460;
const CHART_H = 240;
const PLOT_H = 170;
const COL = CHART_W / CANDLES.length;

function priceY(v: number) {
  return PLOT_H - (v / 200) * PLOT_H + 10;
}

function BacktestMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  const equityPath = (() => {
    const pts = CANDLES.map((c, i) => {
      const x = i * COL + COL / 2;
      const y = CHART_H - 6 - (c.c / 200) * 56;
      return `${x},${y}`;
    });
    return `M ${pts.join(" L ")}`;
  })();

  return (
    <div className={styles.glass} ref={ref}>
      <div className={styles.glassBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.glassBarLabel}>backtest engine</span>
      </div>

      <svg
        className={styles.chartCanvas}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Animated candlestick backtest chart with buy and sell markers and an equity curve"
      >
        {/* candles */}
        {CANDLES.map((c, i) => {
          const x = i * COL + COL / 2;
          const up = c.c >= c.o;
          const color = up ? "#22c55e" : "#ef4444";
          const bodyTop = priceY(Math.max(c.o, c.c));
          const bodyH = Math.max(Math.abs(priceY(c.o) - priceY(c.c)), 2);
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={inView ? { opacity: 1, scaleY: 1 } : {}}
              transition={{ duration: 0.3, delay: i * 0.08, ease: "easeOut" }}
              style={{ transformOrigin: `${x}px ${CHART_H / 2}px` }}
            >
              <line x1={x} y1={priceY(c.h)} x2={x} y2={priceY(c.l)} stroke={color} strokeWidth={1.5} />
              <rect
                x={x - COL * 0.28}
                y={bodyTop}
                width={COL * 0.56}
                height={bodyH}
                fill={color}
                rx={1}
              />
            </motion.g>
          );
        })}

        {/* BUY marker */}
        <motion.g
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.1, duration: 0.4 }}
        >
          <path
            d={`M ${2 * COL + COL / 2} ${priceY(CANDLES[2].l) + 16} l -5 9 l 10 0 z`}
            fill="#22c55e"
          />
        </motion.g>
        {/* SELL marker */}
        <motion.g
          initial={{ opacity: 0, y: -8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.35, duration: 0.4 }}
        >
          <path
            d={`M ${9 * COL + COL / 2} ${priceY(CANDLES[9].h) - 16} l -5 -9 l 10 0 z`}
            fill="#ef4444"
          />
        </motion.g>

        {/* equity curve */}
        <motion.path
          d={equityPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 0.9 } : {}}
          transition={{ delay: 1.4, duration: 1.4, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}

/* ---------------- Step 4: results ---------------- */

function CountUp({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  start,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  start: boolean;
}) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!start) return;
    const controls = animate(mv, to, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v.toFixed(decimals)),
    });
    return () => controls.stop();
  }, [start, to, decimals, mv]);

  return (
    <span>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

const METRICS = [
  { label: "Total Return", to: 24.3, prefix: "+", suffix: "%", decimals: 1, tone: "up" },
  { label: "Sharpe Ratio", to: 1.82, suffix: "", decimals: 2, tone: "" },
  { label: "Win Rate", to: 67, suffix: "%", decimals: 0, tone: "" },
  { label: "Max Drawdown", to: -8.2, suffix: "%", decimals: 1, tone: "down" },
];

const TRADES = [
  { side: "BUY", price: "176.40", pnl: "+4.1%" },
  { side: "SELL", price: "183.62", pnl: "+2.7%" },
  { side: "BUY", price: "188.10", pnl: "+5.3%" },
];

function ResultsMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <div className={styles.glass} ref={ref}>
      <div className={styles.glassBar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.glassBarLabel}>results</span>
      </div>

      <div className={styles.metricGrid}>
        {METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            className={styles.metricCard}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: i * 0.1 }}
          >
            <p className={styles.metricLabel}>{m.label}</p>
            <p
              className={`${styles.metricValue} ${
                m.tone === "up" ? styles.metricUp : m.tone === "down" ? styles.metricDown : ""
              }`}
            >
              <CountUp
                to={m.to}
                prefix={m.prefix}
                suffix={m.suffix}
                decimals={m.decimals}
                start={inView}
              />
            </p>
          </motion.div>
        ))}
      </div>

      <motion.div
        className={styles.tradeLog}
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.55 }}
      >
        <div className={`${styles.tradeRow} ${styles.tradeRowHead}`}>
          <span>Side</span>
          <span>Price</span>
          <span>P&amp;L</span>
        </div>
        {TRADES.map((t, i) => (
          <div className={styles.tradeRow} key={i}>
            <span
              className={`${styles.tradeSide} ${
                t.side === "BUY" ? styles.tradeBuy : styles.tradeSell
              }`}
            >
              {t.side}
            </span>
            <span className={styles.tradeCell}>${t.price}</span>
            <span className={styles.tradeCell}>{t.pnl}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ---------------- Step row ---------------- */

interface StepDef {
  num: string;
  title: string;
  body: string;
  tags: string[];
  mockup: ReactNode;
  reverse: boolean;
}

const PARTICLES = [
  { left: "8%", top: "14%", d: 7, delay: 0 },
  { left: "88%", top: "22%", d: 9, delay: 1.2 },
  { left: "16%", top: "62%", d: 8, delay: 0.6 },
  { left: "78%", top: "72%", d: 10, delay: 1.8 },
  { left: "46%", top: "10%", d: 6, delay: 0.9 },
  { left: "60%", top: "88%", d: 9, delay: 2.2 },
];

export default function HowItWorksJourney() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start center", "end center"],
  });
  const lineScale = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  const steps: StepDef[] = [
    {
      num: "01",
      title: "Choose Your Market",
      body:
        "Toggle between Sandbox mode with synthetic data for risk-free practice, or Live Market mode pulling real stock data from Yahoo Finance for tickers like AAPL, TSLA, and GOOGL.",
      tags: ["Sandbox", "Live Market", "Yahoo Finance"],
      mockup: <DataSourceMockup />,
      reverse: false,
    },
    {
      num: "02",
      title: "Pick a Strategy",
      body:
        "Choose from 8 built-in algorithmic trading strategies — each with tunable parameters — or compare multiple strategies head-to-head to find your edge.",
      tags: ["SMA Crossover", "RSI", "MACD", "Bollinger Bands"],
      mockup: <StrategyMockup />,
      reverse: true,
    },
    {
      num: "03",
      title: "Run the Backtest",
      body:
        "The engine simulates hundreds of trades against historical data, calculating Sharpe ratio, max drawdown, win rate, and more — so you know how a strategy performs before going live.",
      tags: ["Sharpe", "Drawdown", "Win Rate"],
      mockup: <BacktestMockup />,
      reverse: false,
    },
    {
      num: "04",
      title: "Analyze Your Results",
      body:
        "Get institutional-grade analytics including detailed trade logs, equity curves, and strategy comparison tools to refine and iterate on your edge.",
      tags: ["Trade Logs", "Equity Curve", "Comparison"],
      mockup: <ResultsMockup />,
      reverse: true,
    },
  ];

  return (
    <div className={styles.journey}>
      <div className={styles.bgGrid} aria-hidden="true" />
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className={styles.particle}
          style={{ left: p.left, top: p.top }}
          aria-hidden="true"
          animate={{ y: [0, -18, 0], opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: p.d, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      <motion.div
        className={styles.header}
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.6 }}
      >
        <p className={styles.label}>How it works</p>
        <h2 className={styles.title}>From market to insight in four steps</h2>
        <p className={styles.subtitle}>
          Watch the workflow unfold — choose a market, pick a strategy, backtest
          it, and analyze institutional-grade results.
        </p>
      </motion.div>

      <div className={styles.track} ref={trackRef}>
        <motion.div
          className={styles.centerLine}
          style={{ scaleY: lineScale }}
          aria-hidden="true"
        />

        {steps.map((s) => (
          <div className={styles.step} key={s.num}>
            <span
              className={`${styles.bgNumber} ${
                s.reverse ? styles.bgNumberRight : styles.bgNumberLeft
              }`}
              aria-hidden="true"
            >
              {s.num}
            </span>
            <motion.span
              className={styles.node}
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              aria-hidden="true"
            />

            {s.reverse ? (
              <>
                <div className={styles.mockup}>{s.mockup}</div>
                <Copy num={s.num} title={s.title} body={s.body} tags={s.tags} />
              </>
            ) : (
              <>
                <Copy num={s.num} title={s.title} body={s.body} tags={s.tags} />
                <div className={styles.mockup}>{s.mockup}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
