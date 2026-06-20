"use client";

import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import styles from "./simulate.module.css";

// --- Types ---
type Strategy = "sma_crossover" | "rsi" | "bollinger" | "macd";

const strategyLabels: Record<Strategy, string> = {
  sma_crossover: "SMA Crossover",
  rsi: "RSI",
  bollinger: "Bollinger Bands",
  macd: "MACD",
};

interface SimResult {
  totalReturn: number;
  winRate: number;
  totalTrades: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  equityCurve: number[];
  trades: Array<{
    type: "BUY" | "SELL";
    price: number;
    time: string;
    pnl: number;
  }>;
  aiReport: string;
}

// --- Mock simulation engine ---
function runMockSimulation(): SimResult {
  // Generate realistic-looking equity curve
  const equityCurve: number[] = [10000];
  const trades: SimResult["trades"] = [];
  let equity = 10000;

  for (let i = 1; i <= 120; i++) {
    const change = (Math.random() - 0.44) * 150;
    equity = Math.max(equity + change, equity * 0.95);
    equityCurve.push(Math.round(equity * 100) / 100);

    if (i % 8 === 0) {
      const isBuy = Math.random() > 0.5;
      const pnl = (Math.random() - 0.4) * 5;
      trades.push({
        type: isBuy ? "BUY" : "SELL",
        price: 3.5 + Math.random() * 0.8,
        time: `2026-06-${String(14 + Math.floor(i / 20)).padStart(2, "0")} ${String(9 + (i % 8)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
        pnl: Math.round(pnl * 100) / 100,
      });
    }
  }

  const finalReturn = ((equity - 10000) / 10000) * 100;
  const wins = trades.filter((t) => t.pnl > 0).length;

  return {
    totalReturn: Math.round(finalReturn * 100) / 100,
    winRate: Math.round((wins / trades.length) * 10000) / 100,
    totalTrades: trades.length,
    sharpeRatio: Math.round((1.2 + Math.random() * 1.2) * 100) / 100,
    maxDrawdown: Math.round((3 + Math.random() * 5) * 100) / 100,
    profitFactor: Math.round((1.1 + Math.random() * 0.8) * 100) / 100,
    avgWin: Math.round((1.5 + Math.random() * 2) * 100) / 100,
    avgLoss: Math.round((0.8 + Math.random() * 1.2) * 100) / 100,
    equityCurve,
    trades,
    aiReport: `**Performance Summary**: Your ${strategyLabels[selectedStrategyRef]} strategy showed a **${finalReturn > 0 ? "positive" : "negative"}** return of **${Math.abs(Math.round(finalReturn * 100) / 100)}%** over the test period.\n\n**Key Observations**:\n• Win rate of ${Math.round((wins / trades.length) * 100)}% indicates ${wins / trades.length > 0.55 ? "a reliable" : "room for improvement in"} signal generation\n• Maximum drawdown remained controlled, suggesting good risk management\n• The Sharpe ratio indicates ${1.5 > 1 ? "risk-adjusted returns above average" : "moderate risk-adjusted performance"}\n\n**Recommendations**:\n• Consider tightening the stop-loss to reduce max drawdown further\n• The strategy performs best in trending markets — add a trend filter\n• Test with different timeframes to find optimal entry/exit windows`,
  };
}

// Workaround: store selected strategy in a module-level ref for the mock function
let selectedStrategyRef: Strategy = "sma_crossover";

export default function SimulatePage() {
  const [strategy, setStrategy] = useState<Strategy>("sma_crossover");
  const [pair] = useState("SUI/USDC");
  const [timeframe, setTimeframe] = useState("1H");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  // Strategy params
  const [stopLoss, setStopLoss] = useState(2);
  const [takeProfit, setTakeProfit] = useState(4);

  const handleRun = useCallback(() => {
    selectedStrategyRef = strategy;
    setLoading(true);
    setResult(null);

    // Simulate a delay for realism
    setTimeout(() => {
      setResult(runMockSimulation());
      setLoading(false);
    }, 2000);
  }, [strategy]);

  // Equity chart SVG path
  const renderEquityCurve = (data: number[]) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 100;
    const h = 100;

    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    });

    const areaPoints = [...points, `${w},${h}`, `0,${h}`];

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className={styles.equityChartSvg} preserveAspectRatio="none">
        <defs>
          <linearGradient id="equityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.3)" />
            <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints.join(" ")} fill="url(#equityGrad)" />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--color-profit)"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  return (
    <>
      <Navbar />
      <div className={styles.simulatePage}>
        <div className={styles.simulateHeader}>
          <h1 className={styles.simulateTitle}>📊 Backtesting Simulator</h1>
          <p className={styles.simulateSubtitle}>
            Run your strategies against historical data. Tune parameters,
            analyze results, and get AI-powered insights.
          </p>
        </div>

        <div className={styles.simulateBody}>
          {/* Config Panel */}
          <div className={styles.configPanel}>
            <div className={styles.configSection}>
              <div className={styles.configSectionHeader}>📈 Market</div>
              <div className={styles.configSectionBody}>
                <div className={styles.configGroup}>
                  <label className={styles.configLabel}>Trading Pair</label>
                  <select className={styles.configSelect} value={pair} disabled>
                    <option value="SUI/USDC">SUI / USDC</option>
                    <option value="DEEP/USDC">DEEP / USDC</option>
                  </select>
                </div>
                <div className={styles.configGroup}>
                  <label className={styles.configLabel}>Timeframe</label>
                  <select
                    className={styles.configSelect}
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                  >
                    {["1m", "5m", "15m", "1H", "4H", "1D"].map((tf) => (
                      <option key={tf} value={tf}>
                        {tf}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.configGroup}>
                  <label className={styles.configLabel}>
                    Backtest Period{" "}
                    <span className={styles.configValue}>{days} days</span>
                  </label>
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="30"
                    value={days}
                    onChange={(e) => setDays(+e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={styles.configSection}>
              <div className={styles.configSectionHeader}>⚙️ Strategy</div>
              <div className={styles.configSectionBody}>
                <div className={styles.configGroup}>
                  <label className={styles.configLabel}>Algorithm</label>
                  <select
                    className={styles.configSelect}
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as Strategy)}
                  >
                    {Object.entries(strategyLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.configGroup}>
                  <label className={styles.configLabel}>
                    Stop Loss{" "}
                    <span className={styles.configValue}>{stopLoss}%</span>
                  </label>
                  <input
                    type="range"
                    className="slider"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(+e.target.value)}
                  />
                </div>
                <div className={styles.configGroup}>
                  <label className={styles.configLabel}>
                    Take Profit{" "}
                    <span className={styles.configValue}>{takeProfit}%</span>
                  </label>
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="20"
                    step="0.5"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(+e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              className={`btn btn-primary ${styles.runButton}`}
              onClick={handleRun}
              disabled={loading}
            >
              {loading ? "⏳ Running..." : "🚀 Run Backtest"}
            </button>
          </div>

          {/* Results Area */}
          <div className={styles.resultsArea}>
            {!result && !loading && (
              <div className={styles.resultsEmpty}>
                <div className={styles.resultsEmptyIcon}>🧪</div>
                <h3 className={styles.resultsEmptyTitle}>
                  Ready to Simulate
                </h3>
                <p className={styles.resultsEmptyText}>
                  Configure your strategy parameters and click &quot;Run
                  Backtest&quot; to see how your algorithm would have performed
                  on historical data.
                </p>
              </div>
            )}

            {loading && (
              <div className={styles.loadingOverlay}>
                <div className={styles.spinner} />
                <p className={styles.loadingText}>Running Simulation...</p>
                <p className={styles.loadingSubtext}>
                  Backtesting {strategyLabels[strategy]} on {pair} ({days} days)
                </p>
              </div>
            )}

            {result && !loading && (
              <>
                {/* Result Stats */}
                <div className={styles.resultsStats}>
                  <div className={styles.resultStat}>
                    <div className={styles.resultStatLabel}>Total Return</div>
                    <div
                      className={styles.resultStatValue}
                      style={{
                        color:
                          result.totalReturn >= 0
                            ? "var(--color-profit)"
                            : "var(--color-loss)",
                      }}
                    >
                      {result.totalReturn >= 0 ? "+" : ""}
                      {result.totalReturn}%
                    </div>
                  </div>
                  <div className={styles.resultStat}>
                    <div className={styles.resultStatLabel}>Win Rate</div>
                    <div
                      className={styles.resultStatValue}
                      style={{
                        color:
                          result.winRate > 50
                            ? "var(--color-profit)"
                            : "var(--color-loss)",
                      }}
                    >
                      {result.winRate}%
                    </div>
                  </div>
                  <div className={styles.resultStat}>
                    <div className={styles.resultStatLabel}>Sharpe Ratio</div>
                    <div className={styles.resultStatValue}>
                      {result.sharpeRatio}
                    </div>
                  </div>
                  <div className={styles.resultStat}>
                    <div className={styles.resultStatLabel}>Max Drawdown</div>
                    <div
                      className={styles.resultStatValue}
                      style={{ color: "var(--color-loss)" }}
                    >
                      -{result.maxDrawdown}%
                    </div>
                  </div>
                  <div className={styles.resultStat}>
                    <div className={styles.resultStatLabel}>Total Trades</div>
                    <div className={styles.resultStatValue}>
                      {result.totalTrades}
                    </div>
                  </div>
                  <div className={styles.resultStat}>
                    <div className={styles.resultStatLabel}>Profit Factor</div>
                    <div className={styles.resultStatValue}>
                      {result.profitFactor}
                    </div>
                  </div>
                  <div className={styles.resultStat}>
                    <div className={styles.resultStatLabel}>Avg Win</div>
                    <div
                      className={styles.resultStatValue}
                      style={{ color: "var(--color-profit)" }}
                    >
                      +{result.avgWin}%
                    </div>
                  </div>
                  <div className={styles.resultStat}>
                    <div className={styles.resultStatLabel}>Avg Loss</div>
                    <div
                      className={styles.resultStatValue}
                      style={{ color: "var(--color-loss)" }}
                    >
                      -{result.avgLoss}%
                    </div>
                  </div>
                </div>

                {/* Equity Curve */}
                <div className={styles.equityChart}>
                  <div className={styles.equityChartTitle}>
                    📈 Equity Curve
                  </div>
                  {renderEquityCurve(result.equityCurve)}
                </div>

                {/* AI Report */}
                <div className={styles.aiReportCard}>
                  <div className={styles.aiReportHeader}>
                    <span>🤖</span>
                    <span className={styles.aiReportTitle}>
                      AI Performance Analysis
                    </span>
                    <span className="badge badge-accent">AI Generated</span>
                  </div>
                  <div className={styles.aiReportBody}>
                    {result.aiReport.split("\n\n").map((paragraph, i) => (
                      <p key={i}>
                        {paragraph.split("**").map((part, j) =>
                          j % 2 === 1 ? (
                            <strong key={j}>{part}</strong>
                          ) : (
                            <span key={j}>{part}</span>
                          )
                        )}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Trades Table */}
                <div className={styles.tradesTable}>
                  <div className={styles.tradesTableTitle}>
                    📋 Trade Log ({result.trades.length} trades)
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Price</th>
                          <th>Time</th>
                          <th>P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((trade, i) => (
                          <tr key={i}>
                            <td>
                              <span
                                style={{
                                  color:
                                    trade.type === "BUY"
                                      ? "var(--color-profit)"
                                      : "var(--color-loss)",
                                  fontWeight: 600,
                                }}
                              >
                                {trade.type}
                              </span>
                            </td>
                            <td className="mono">
                              ${trade.price.toFixed(4)}
                            </td>
                            <td className="mono" style={{ color: "var(--text-tertiary)", fontSize: "0.8125rem" }}>
                              {trade.time}
                            </td>
                            <td>
                              <span
                                className="mono"
                                style={{
                                  color:
                                    trade.pnl >= 0
                                      ? "var(--color-profit)"
                                      : "var(--color-loss)",
                                  fontWeight: 700,
                                }}
                              >
                                {trade.pnl >= 0 ? "+" : ""}
                                {trade.pnl}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
