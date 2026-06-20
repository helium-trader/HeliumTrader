import Navbar from "@/components/Navbar";
import Link from "next/link";
import styles from "./reports.module.css";

interface Report {
  id: number;
  date: string;
  strategy: string;
  pair: string;
  metrics: {
    totalReturn: number;
    winRate: number;
    trades: number;
    sharpeRatio: number;
  };
  summary: string;
  recommendations: string[];
  storageId: string;
}

const mockReports: Report[] = [
  {
    id: 1,
    date: "June 19, 2026",
    strategy: "SMA Crossover",
    pair: "SUI/USDC",
    metrics: { totalReturn: 4.82, winRate: 67.3, trades: 23, sharpeRatio: 1.94 },
    summary:
      "Strong performance driven by a clear uptrend in SUI/USDC. The strategy captured 3 major swings with tight risk management. Consecutive wins in the London and New York sessions contributed most to returns.",
    recommendations: [
      "Consider increasing position size during confirmed trend days — 100% of signals fired in the trending direction.",
      "The 9/21 SMA periods were optimal for the 1H timeframe. Test 12/26 for 4H charts.",
      "A 2% stop-loss prevented 4 potential losing trades from exceeding risk tolerance.",
    ],
    storageId: "0x7f3a...8b2c",
  },
  {
    id: 2,
    date: "June 18, 2026",
    strategy: "RSI",
    pair: "SUI/USDC",
    metrics: { totalReturn: -1.23, winRate: 42.1, trades: 19, sharpeRatio: 0.67 },
    summary:
      "Choppy market conditions led to multiple false signals. Ranging price action between $3.72–$3.88 caused several whipsaws. Losses were contained thanks to the 2% stop-loss configuration.",
    recommendations: [
      "Add a trend filter (e.g. 50-period SMA) to avoid trading signals during ranging markets.",
      "Widen RSI oversold/overbought thresholds to 25/75 during low-volatility periods.",
      "Reduce position size when ATR drops below the 20-day average.",
    ],
    storageId: "0x3e1b...9d4f",
  },
];

const summary = [
  { label: "Total P&L · 7d", value: "+$482.37", sub: "+4.82% from initial", tone: "profit" as const },
  { label: "Avg win rate · 7d", value: "58.4%", sub: "+3.1% vs last week", tone: "profit" as const },
  { label: "Reports generated", value: String(mockReports.length), sub: "Stored on Walrus", tone: "neutral" as const },
];

export default function ReportsPage() {
  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Reports</p>
            <h1 className={styles.title}>AI trading reports</h1>
            <p className={styles.subtitle}>
              Performance analysis with actionable insights. Every report is stored permanently on Walrus.
            </p>
          </header>

          {/* Summary */}
          <section className={styles.summaryGrid}>
            {summary.map((s) => (
              <div className={styles.summaryCard} key={s.label}>
                <span className={styles.summaryLabel}>{s.label}</span>
                <span className={`${styles.summaryValue} ${s.tone === "profit" ? "profit" : ""}`}>
                  {s.value}
                </span>
                <span className={styles.summarySub}>{s.sub}</span>
              </div>
            ))}
          </section>

          {/* Report list */}
          <section className={styles.reportList}>
            {mockReports.map((report) => (
              <article className={styles.reportCard} key={report.id}>
                <div className={styles.reportHead}>
                  <div className={styles.reportHeadLeft}>
                    <span className={styles.reportDate}>{report.date}</span>
                    <div className={styles.reportTags}>
                      <span className={styles.tag}>{report.strategy}</span>
                      <span className={styles.tag}>{report.pair}</span>
                    </div>
                  </div>
                  <span className={styles.storageId}>{report.storageId}</span>
                </div>

                <div className={styles.metricRow}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Return</span>
                    <span className={`${styles.metricValue} ${report.metrics.totalReturn >= 0 ? "profit" : "loss"}`}>
                      {report.metrics.totalReturn >= 0 ? "+" : ""}{report.metrics.totalReturn}%
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Win rate</span>
                    <span className={`${styles.metricValue} ${report.metrics.winRate > 50 ? "profit" : "loss"}`}>
                      {report.metrics.winRate}%
                    </span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Trades</span>
                    <span className={styles.metricValue}>{report.metrics.trades}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Sharpe</span>
                    <span className={styles.metricValue}>{report.metrics.sharpeRatio}</span>
                  </div>
                </div>

                <div className={styles.reportSection}>
                  <h2 className={styles.sectionLabel}>Analysis</h2>
                  <p className={styles.reportText}>{report.summary}</p>
                </div>

                <div className={styles.reportSection}>
                  <h2 className={styles.sectionLabel}>Recommendations</h2>
                  <ul className={styles.recList}>
                    {report.recommendations.map((rec, i) => (
                      <li className={styles.recItem} key={i}>
                        <span className={styles.recMarker} aria-hidden="true" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </section>

          {/* CTA */}
          <section className={styles.cta}>
            <h2 className={styles.ctaTitle}>Generate more reports</h2>
            <p className={styles.ctaText}>
              Run a simulation or paper trade to generate a new AI performance report.
            </p>
            <Link href="/simulate" className="btn btn-primary btn-lg">
              Run a simulation
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
