import Navbar from "@/components/Navbar";
import Link from "next/link";
import EducationHub from "@/components/EducationHub";
import styles from "./education.module.css";

interface Algorithm {
  id: string;
  name: string;
  tag: string;
  summary: string;
  howItWorks: string;
  bestFor: string;
  watchOut: string;
  params: { label: string; desc: string }[];
}

const algorithms: Algorithm[] = [
  {
    id: "sma-crossover",
    name: "SMA Crossover",
    tag: "Trend following",
    summary:
      "Uses two simple moving averages — a fast one and a slow one — to detect shifts in trend direction.",
    howItWorks:
      "A simple moving average (SMA) is the average closing price over a set number of periods. The strategy tracks a fast SMA (short lookback) and a slow SMA (long lookback). When the fast SMA crosses above the slow SMA it signals upward momentum (a buy); when it crosses below, it signals downward momentum (a sell). The crossover is the trigger.",
    bestFor:
      "Clear, sustained trends — markets that move in one direction for a while. It shines on higher timeframes where noise is reduced.",
    watchOut:
      "In sideways or choppy markets the averages cross back and forth, generating false signals known as whipsaws. Pair it with a trend filter to reduce these.",
    params: [
      { label: "Fast Period", desc: "Lookback for the responsive average (e.g. 9). Lower reacts faster but is noisier." },
      { label: "Slow Period", desc: "Lookback for the smooth average (e.g. 21). Higher confirms the broader trend." },
    ],
  },
  {
    id: "rsi",
    name: "RSI",
    tag: "Momentum oscillator",
    summary:
      "The Relative Strength Index measures the speed and magnitude of price moves to find overbought and oversold conditions.",
    howItWorks:
      "RSI is calculated from average gains versus average losses over a period, producing a value between 0 and 100. Readings below the oversold threshold (commonly 30) suggest the asset may be undervalued and due for a bounce (a buy). Readings above the overbought threshold (commonly 70) suggest it may be overextended and due to pull back (a sell).",
    bestFor:
      "Range-bound markets that oscillate between support and resistance, where mean reversion is reliable.",
    watchOut:
      "During strong trends RSI can stay overbought or oversold for a long time. A high RSI alone is not a sell signal in a powerful uptrend.",
    params: [
      { label: "RSI Period", desc: "Number of periods in the calculation (e.g. 14). Shorter is more sensitive." },
      { label: "Oversold", desc: "Lower threshold that triggers buy interest (e.g. 30)." },
      { label: "Overbought", desc: "Upper threshold that triggers sell interest (e.g. 70)." },
    ],
  },
  {
    id: "bollinger",
    name: "Bollinger Bands",
    tag: "Volatility / mean reversion",
    summary:
      "Plots bands a set number of standard deviations above and below a moving average to frame price relative to recent volatility.",
    howItWorks:
      "A middle band is a moving average; the upper and lower bands sit a chosen number of standard deviations away. Because standard deviation grows with volatility, the bands widen in volatile markets and contract in calm ones. Price tagging the lower band can signal a stretched, oversold condition (a buy); tagging the upper band can signal an overbought condition (a sell). A sharp contraction (a squeeze) often precedes a large move.",
    bestFor:
      "Mean-reversion entries in ranging markets, and spotting volatility squeezes that lead to breakouts.",
    watchOut:
      "In a strong trend price can ride one band continuously. Touching a band is context, not an automatic reversal.",
    params: [
      { label: "Period", desc: "Lookback for the middle moving average (e.g. 20)." },
      { label: "Std Dev", desc: "How many standard deviations the bands sit from the average (e.g. 2). Higher = wider bands." },
    ],
  },
  {
    id: "macd",
    name: "MACD",
    tag: "Trend + momentum",
    summary:
      "Moving Average Convergence Divergence combines trend and momentum by comparing two exponential moving averages.",
    howItWorks:
      "The MACD line is the difference between a fast and a slow exponential moving average (EMA). A signal line (an EMA of the MACD line) is plotted on top. When the MACD line crosses above the signal line, momentum is turning up (a buy); when it crosses below, momentum is turning down (a sell). The histogram showing the gap between the two lines helps gauge strength.",
    bestFor:
      "Confirming the start and end of trends, and catching momentum shifts earlier than a simple price crossover.",
    watchOut:
      "MACD is a lagging indicator built from averages, so signals arrive after a move has begun. It is less reliable in tight ranges.",
    params: [
      { label: "Fast Period", desc: "Lookback for the fast EMA (e.g. 12)." },
      { label: "Slow Period", desc: "Lookback for the slow EMA (e.g. 26)." },
      { label: "Signal Period", desc: "EMA applied to the MACD line to create the trigger (e.g. 9)." },
    ],
  },
];

const riskConcepts = [
  {
    term: "Stop Loss",
    desc: "A preset price at which a losing trade is automatically closed to cap the downside on any single position.",
  },
  {
    term: "Take Profit",
    desc: "A preset price at which a winning trade is automatically closed to lock in gains before the market reverses.",
  },
  {
    term: "Win Rate",
    desc: "The percentage of trades that close profitably. A high win rate is not enough on its own — average win size matters too.",
  },
  {
    term: "Sharpe Ratio",
    desc: "Return earned per unit of risk taken. Higher is better; above 1 is generally considered good, above 2 excellent.",
  },
  {
    term: "Max Drawdown",
    desc: "The largest peak-to-trough drop in account value. It measures the worst losing streak you would have endured.",
  },
  {
    term: "Profit Factor",
    desc: "Gross profit divided by gross loss. Above 1 means the strategy made more than it lost over the test.",
  },
];

export default function EducationPage() {
  return (
    <>
      <Navbar />
      <main className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <span className={styles.eyebrow}>Learn</span>
          <h1 className={styles.title}>Trading algorithms explained</h1>
          <p className={styles.subtitle}>
            A plain-language guide to the strategies you can configure in HeliumTrader —
            what each one does, when it works best, and the parameters that shape it.
          </p>
        </header>

        {/* Interactive hub */}
        <EducationHub />

        {/* Quick nav */}
        <nav className={styles.quickNav} aria-label="Jump to algorithm">
          {algorithms.map((a) => (
            <a key={a.id} href={`#${a.id}`} className={styles.quickNavItem}>
              {a.name}
            </a>
          ))}
        </nav>

        {/* Algorithms */}
        <section className={styles.algoList}>
          {algorithms.map((algo, i) => (
            <article key={algo.id} id={algo.id} className={styles.algoCard}>
              <div className={styles.algoHead}>
                <span className={styles.algoIndex}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className={styles.algoName}>{algo.name}</h2>
                  <span className={styles.algoTag}>{algo.tag}</span>
                </div>
              </div>

              <p className={styles.algoSummary}>{algo.summary}</p>

              <div className={styles.algoBlock}>
                <h3 className={styles.blockLabel}>How it works</h3>
                <p className={styles.blockText}>{algo.howItWorks}</p>
              </div>

              <div className={styles.algoGrid}>
                <div className={styles.algoBlock}>
                  <h3 className={styles.blockLabel}>Best used for</h3>
                  <p className={styles.blockText}>{algo.bestFor}</p>
                </div>
                <div className={styles.algoBlock}>
                  <h3 className={styles.blockLabel}>Watch out for</h3>
                  <p className={styles.blockText}>{algo.watchOut}</p>
                </div>
              </div>

              <div className={styles.algoBlock}>
                <h3 className={styles.blockLabel}>Key parameters</h3>
                <ul className={styles.paramList}>
                  {algo.params.map((p) => (
                    <li key={p.label} className={styles.paramItem}>
                      <span className={styles.paramName}>{p.label}</span>
                      <span className={styles.paramDesc}>{p.desc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>

        {/* Risk concepts */}
        <section className={styles.glossary}>
          <h2 className={styles.glossaryTitle}>Metrics &amp; risk controls</h2>
          <p className={styles.glossarySubtitle}>
            The numbers every strategy is judged by, and the guardrails that keep risk in check.
          </p>
          <div className={styles.glossaryGrid}>
            {riskConcepts.map((c) => (
              <div key={c.term} className={styles.glossaryCard}>
                <h3 className={styles.glossaryTerm}>{c.term}</h3>
                <p className={styles.glossaryDesc}>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className={styles.cta}>
          <h2 className={styles.ctaTitle}>Ready to try one?</h2>
          <p className={styles.ctaText}>
            Configure any of these strategies and backtest them against historical data — no risk, no capital required.
          </p>
          <div className={styles.ctaActions}>
            <Link href="/simulate" className="btn btn-primary btn-lg">
              Run a backtest
            </Link>
            <Link href="/dashboard" className="btn btn-secondary btn-lg">
              Open dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
