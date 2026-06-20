import Navbar from "@/components/Navbar";
import Link from "next/link";
import styles from "./reports.module.css";

// Mock report data
const mockReports = [
  {
    id: 1,
    date: "June 19, 2026",
    strategy: "SMA Crossover",
    pair: "SUI/USDC",
    metrics: {
      totalReturn: 4.82,
      winRate: 67.3,
      trades: 23,
      sharpeRatio: 1.94,
    },
    summary:
      "Strong performance day driven by a clear uptrend in SUI/USDC. The SMA Crossover strategy captured 3 major swings with tight risk management. Consecutive wins in the London and New York sessions contributed most to returns.",
    recommendations: [
      "Consider increasing position size during confirmed trend days — the strategy performed well with 100% of signals in trending direction",
      "The 9/21 SMA periods were optimal for the 1H timeframe. Test 12/26 for 4H charts",
      "Stop-loss of 2% prevented 4 potential losing trades from exceeding risk tolerance",
    ],
    walrusId: "0x7f3a...8b2c",
  },
  {
    id: 2,
    date: "June 18, 2026",
    strategy: "RSI",
    pair: "SUI/USDC",
    metrics: {
      totalReturn: -1.23,
      winRate: 42.1,
      trades: 19,
      sharpeRatio: 0.67,
    },
    summary:
      "Choppy market conditions led to multiple false signals from the RSI strategy. The ranging price action between $3.72-$3.88 caused several whipsaws. Losses were contained thanks to the 2% stop-loss configuration.",
    recommendations: [
      "Add a trend filter (e.g., 50-period SMA) to avoid trading RSI signals during ranging markets",
      "Consider widening RSI oversold/overbought thresholds to 25/75 during low-volatility periods",
      "Reduce position size when ATR (Average True Range) drops below the 20-day average",
    ],
    walrusId: "0x3e1b...9d4f",
  },
];

export default function ReportsPage() {
  return (
    <>
      <Navbar />
      <div className={styles.reportsPage}>
        <div className={styles.reportsHeader}>
          <h1 className={styles.reportsTitle}>🤖 AI Trading Reports</h1>
          <p className={styles.reportsSubtitle}>
            AI-generated performance analysis with actionable insights. All
            reports stored permanently on Walrus.
          </p>
        </div>

        <div className={styles.reportsBody}>
          {/* Summary Row */}
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardIcon}>💰</div>
              <div className={styles.summaryCardLabel}>Total P&L (7 Days)</div>
              <div className={styles.summaryCardValue} style={{ color: "var(--color-profit)" }}>
                +$482.37
              </div>
              <div className={styles.summaryCardChange} style={{ color: "var(--color-profit)" }}>
                +4.82% from initial
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardIcon}>📊</div>
              <div className={styles.summaryCardLabel}>
                Avg Win Rate (7 Days)
              </div>
              <div className={styles.summaryCardValue} style={{ color: "var(--color-profit)" }}>
                58.4%
              </div>
              <div className={styles.summaryCardChange} style={{ color: "var(--color-profit)" }}>
                ↑ 3.1% vs last week
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardIcon}>📝</div>
              <div className={styles.summaryCardLabel}>Reports Generated</div>
              <div className={styles.summaryCardValue}>
                {mockReports.length}
              </div>
              <div className={styles.summaryCardChange} style={{ color: "var(--text-tertiary)" }}>
                All stored on Walrus
              </div>
            </div>
          </div>

          {/* Report Cards */}
          {mockReports.map((report) => (
            <div className={styles.reportCard} key={report.id}>
              <div className={styles.reportCardHeader}>
                <div className={styles.reportCardHeaderLeft}>
                  <span className={styles.reportCardDate}>{report.date}</span>
                  <span className="badge badge-accent">{report.strategy}</span>
                  <span className="badge badge-accent">{report.pair}</span>
                </div>
                <div className={styles.walrusBadge}>
                  🐘 Walrus: {report.walrusId}
                </div>
              </div>
              <div className={styles.reportCardBody}>
                {/* Metrics */}
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>
                    📈 Performance Metrics
                  </h3>
                  <div className={styles.reportMetrics}>
                    <div className={styles.reportMetric}>
                      <div className={styles.reportMetricLabel}>
                        Total Return
                      </div>
                      <div
                        className={styles.reportMetricValue}
                        style={{
                          color:
                            report.metrics.totalReturn >= 0
                              ? "var(--color-profit)"
                              : "var(--color-loss)",
                        }}
                      >
                        {report.metrics.totalReturn >= 0 ? "+" : ""}
                        {report.metrics.totalReturn}%
                      </div>
                    </div>
                    <div className={styles.reportMetric}>
                      <div className={styles.reportMetricLabel}>Win Rate</div>
                      <div
                        className={styles.reportMetricValue}
                        style={{
                          color:
                            report.metrics.winRate > 50
                              ? "var(--color-profit)"
                              : "var(--color-loss)",
                        }}
                      >
                        {report.metrics.winRate}%
                      </div>
                    </div>
                    <div className={styles.reportMetric}>
                      <div className={styles.reportMetricLabel}>Trades</div>
                      <div className={styles.reportMetricValue}>
                        {report.metrics.trades}
                      </div>
                    </div>
                    <div className={styles.reportMetric}>
                      <div className={styles.reportMetricLabel}>
                        Sharpe Ratio
                      </div>
                      <div className={styles.reportMetricValue}>
                        {report.metrics.sharpeRatio}
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Summary */}
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>
                    🤖 AI Analysis
                  </h3>
                  <p className={styles.reportText}>{report.summary}</p>
                </div>

                {/* Recommendations */}
                <div className={styles.reportSection}>
                  <h3 className={styles.reportSectionTitle}>
                    💡 Recommendations
                  </h3>
                  <div className={styles.recommendations}>
                    {report.recommendations.map((rec, i) => (
                      <div className={styles.recommendation} key={i}>
                        <span className={styles.recommendationIcon}>→</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Generate Report CTA */}
          <div className={styles.emptyReports}>
            <div className={styles.emptyReportsIcon}>🧠</div>
            <h3 className={styles.emptyReportsTitle}>
              Generate More Reports
            </h3>
            <p className={styles.emptyReportsText}>
              Run simulations or paper trades to generate AI-powered
              performance reports. Each report is permanently stored on Walrus.
            </p>
            <Link href="/simulate" className="btn btn-primary btn-lg">
              Run a Simulation →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
