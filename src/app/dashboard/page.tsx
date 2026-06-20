"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import styles from "./dashboard.module.css";

// --- Types ---
type Strategy = "sma_crossover" | "rsi" | "bollinger" | "macd";
type Mode = "simulate" | "paper";

interface StrategyParams {
  sma_crossover: { fastPeriod: number; slowPeriod: number; stopLoss: number; takeProfit: number };
  rsi: { period: number; oversold: number; overbought: number; stopLoss: number; takeProfit: number };
  bollinger: { period: number; stdDev: number; stopLoss: number; takeProfit: number };
  macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number; stopLoss: number; takeProfit: number };
}

const strategyLabels: Record<Strategy, string> = {
  sma_crossover: "SMA Crossover",
  rsi: "RSI (Relative Strength Index)",
  bollinger: "Bollinger Bands",
  macd: "MACD",
};

const defaultParams: StrategyParams = {
  sma_crossover: { fastPeriod: 9, slowPeriod: 21, stopLoss: 2, takeProfit: 4 },
  rsi: { period: 14, oversold: 30, overbought: 70, stopLoss: 2, takeProfit: 4 },
  bollinger: { period: 20, stdDev: 2, stopLoss: 2, takeProfit: 4 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, stopLoss: 2, takeProfit: 4 },
};

// --- Mock Data ---
const mockTrades = [
  { type: "BUY", pair: "SUI/USDC", time: "14:32:18", pnl: "+2.45%", profit: true },
  { type: "SELL", pair: "SUI/USDC", time: "14:28:02", pnl: "-0.82%", profit: false },
  { type: "BUY", pair: "SUI/USDC", time: "14:15:44", pnl: "+1.17%", profit: true },
  { type: "SELL", pair: "SUI/USDC", time: "14:08:31", pnl: "+3.21%", profit: true },
  { type: "BUY", pair: "SUI/USDC", time: "13:55:12", pnl: "-1.05%", profit: false },
];

// Generate mock candlestick data
function generateCandles(count: number) {
  const candles = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * 6;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    candles.push({
      open,
      close,
      high,
      low,
      green: close >= open,
    });
    price = close;
  }
  return candles;
}

export default function DashboardPage() {
  const [mode, setMode] = useState<Mode>("simulate");
  const [strategy, setStrategy] = useState<Strategy>("sma_crossover");
  const [params, setParams] = useState(defaultParams);

  const candles = useMemo(() => generateCandles(60), []);

  const currentParams = params[strategy];

  const updateParam = (key: string, value: number) => {
    setParams((prev) => ({
      ...prev,
      [strategy]: { ...prev[strategy], [key]: value },
    }));
  };

  // Compute chart scaling
  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;
  const chartHeight = 360;

  const scaleY = (price: number) =>
    ((price - minPrice) / priceRange) * chartHeight;

  return (
    <>
      <Navbar />
      <div className={styles.dashboardLayout}>
        <div className={styles.dashboardHeader}>
          <div className={styles.dashboardTitleRow}>
            <h1 className={styles.dashboardTitle}>Trading Dashboard</h1>
            <div className={styles.dashboardMode}>
              <button
                className={`${styles.modeBtn} ${mode === "simulate" ? styles.modeBtnActive : ""}`}
                onClick={() => setMode("simulate")}
              >
                📊 Simulate
              </button>
              <button
                className={`${styles.modeBtn} ${mode === "paper" ? styles.modeBtnActive : ""}`}
                onClick={() => setMode("paper")}
              >
                📝 Paper Trade
              </button>
            </div>
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          {/* Stats Bar */}
          <div className={styles.statsBar}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Portfolio Value</span>
              <span className={styles.statValue}>$10,247.83</span>
              <span className={`${styles.statChange} profit`}>+2.47%</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Win Rate</span>
              <span className={`${styles.statValue} profit`}>64.3%</span>
              <span className={`${styles.statChange} profit`}>↑ 3.2%</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Total Trades</span>
              <span className={styles.statValue}>127</span>
              <span className={styles.statChange} style={{ color: "var(--text-tertiary)" }}>
                Last 7 days
              </span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Sharpe Ratio</span>
              <span className={`${styles.statValue} profit`}>1.84</span>
              <span className={`${styles.statChange} profit`}>Good</span>
            </div>
          </div>

          {/* Chart Area */}
          <div className={styles.chartArea}>
            <div className={styles.chartPanel}>
              <div className={styles.chartHeader}>
                <div className={styles.chartPair}>
                  <span className={styles.chartPairName}>SUI / USDC</span>
                  <span className={`${styles.chartPairPrice} profit`}>
                    $3.847
                  </span>
                  <span className="badge badge-profit">+2.41%</span>
                </div>
                <div className={styles.chartTimeframes}>
                  {["1m", "5m", "15m", "1H", "4H", "1D"].map((tf) => (
                    <button
                      key={tf}
                      className={`${styles.timeframeBtn} ${tf === "1H" ? styles.timeframeBtnActive : ""}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.chartBody}>
                <div className={styles.chartPlaceholder}>
                  {candles.map((candle, i) => {
                    const bodyTop = scaleY(Math.max(candle.open, candle.close));
                    const bodyBottom = scaleY(Math.min(candle.open, candle.close));
                    const bodyHeight = Math.max(bodyTop - bodyBottom, 2);
                    const wickTop = scaleY(candle.high) - bodyTop;
                    const wickBottom = bodyBottom - scaleY(candle.low);

                    return (
                      <div
                        key={i}
                        className={`${styles.candlestick} ${candle.green ? styles.candleGreen : styles.candleRed}`}
                        style={{
                          animationDelay: `${i * 15}ms`,
                        }}
                      >
                        <div
                          className={styles.candleWick}
                          style={{ height: `${Math.max(wickTop, 0)}px` }}
                        />
                        <div
                          className={styles.candleBody}
                          style={{ height: `${bodyHeight}px` }}
                        />
                        <div
                          className={styles.candleWick}
                          style={{ height: `${Math.max(wickBottom, 0)}px` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.sidebar}>
            {/* Parameter Panel */}
            <div className={styles.paramPanel}>
              <div className={styles.paramHeader}>
                <span className={styles.paramTitle}>⚙️ Strategy Parameters</span>
                <span className="badge badge-accent">{strategyLabels[strategy]}</span>
              </div>
              <div className={styles.paramBody}>
                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>Strategy</label>
                  <select
                    className={styles.strategySelect}
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value as Strategy)}
                  >
                    {Object.entries(strategyLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Parameters */}
                {strategy === "sma_crossover" && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Fast Period{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.sma_crossover).fastPeriod}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="3"
                        max="50"
                        value={(currentParams as typeof defaultParams.sma_crossover).fastPeriod}
                        onChange={(e) => updateParam("fastPeriod", +e.target.value)}
                      />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Slow Period{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.sma_crossover).slowPeriod}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="10"
                        max="200"
                        value={(currentParams as typeof defaultParams.sma_crossover).slowPeriod}
                        onChange={(e) => updateParam("slowPeriod", +e.target.value)}
                      />
                    </div>
                  </>
                )}

                {strategy === "rsi" && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        RSI Period{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.rsi).period}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="5"
                        max="50"
                        value={(currentParams as typeof defaultParams.rsi).period}
                        onChange={(e) => updateParam("period", +e.target.value)}
                      />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Oversold{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.rsi).oversold}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="10"
                        max="40"
                        value={(currentParams as typeof defaultParams.rsi).oversold}
                        onChange={(e) => updateParam("oversold", +e.target.value)}
                      />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Overbought{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.rsi).overbought}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="60"
                        max="90"
                        value={(currentParams as typeof defaultParams.rsi).overbought}
                        onChange={(e) => updateParam("overbought", +e.target.value)}
                      />
                    </div>
                  </>
                )}

                {strategy === "bollinger" && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Period{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.bollinger).period}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="5"
                        max="50"
                        value={(currentParams as typeof defaultParams.bollinger).period}
                        onChange={(e) => updateParam("period", +e.target.value)}
                      />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Std Deviation{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.bollinger).stdDev}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="1"
                        max="4"
                        step="0.5"
                        value={(currentParams as typeof defaultParams.bollinger).stdDev}
                        onChange={(e) => updateParam("stdDev", +e.target.value)}
                      />
                    </div>
                  </>
                )}

                {strategy === "macd" && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Fast Period{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.macd).fastPeriod}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="5"
                        max="30"
                        value={(currentParams as typeof defaultParams.macd).fastPeriod}
                        onChange={(e) => updateParam("fastPeriod", +e.target.value)}
                      />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Slow Period{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.macd).slowPeriod}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="15"
                        max="50"
                        value={(currentParams as typeof defaultParams.macd).slowPeriod}
                        onChange={(e) => updateParam("slowPeriod", +e.target.value)}
                      />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Signal Period{" "}
                        <span className={styles.paramValue}>{(currentParams as typeof defaultParams.macd).signalPeriod}</span>
                      </label>
                      <input
                        type="range"
                        className="slider"
                        min="3"
                        max="20"
                        value={(currentParams as typeof defaultParams.macd).signalPeriod}
                        onChange={(e) => updateParam("signalPeriod", +e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Common params */}
                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>
                    Stop Loss{" "}
                    <span className={styles.paramValue}>{currentParams.stopLoss}%</span>
                  </label>
                  <input
                    type="range"
                    className="slider"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={currentParams.stopLoss}
                    onChange={(e) => updateParam("stopLoss", +e.target.value)}
                  />
                </div>
                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>
                    Take Profit{" "}
                    <span className={styles.paramValue}>{currentParams.takeProfit}%</span>
                  </label>
                  <input
                    type="range"
                    className="slider"
                    min="1"
                    max="20"
                    step="0.5"
                    value={currentParams.takeProfit}
                    onChange={(e) => updateParam("takeProfit", +e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.paramActions}>
                <button className="btn btn-primary" style={{ width: "100%" }}>
                  {mode === "simulate" ? "🚀 Run Simulation" : "▶️ Start Paper Trading"}
                </button>
                <button className="btn btn-secondary" style={{ width: "100%" }}>
                  🔄 Reset Parameters
                </button>
              </div>
            </div>

            {/* Trade History */}
            <div className={styles.historyPanel}>
              <div className={styles.historyHeader}>
                <span className={styles.historyTitle}>📋 Recent Trades</span>
              </div>
              <div className={styles.historyBody}>
                {mode === "simulate" ? (
                  mockTrades.map((trade, i) => (
                    <div className={styles.tradeRow} key={i}>
                      <div className={styles.tradeInfo}>
                        <span
                          className={styles.tradeType}
                          style={{
                            color:
                              trade.type === "BUY"
                                ? "var(--color-profit)"
                                : "var(--color-loss)",
                          }}
                        >
                          {trade.type} {trade.pair}
                        </span>
                        <span className={styles.tradeTime}>{trade.time}</span>
                      </div>
                      <span
                        className={styles.tradePnl}
                        style={{
                          color: trade.profit
                            ? "var(--color-profit)"
                            : "var(--color-loss)",
                        }}
                      >
                        {trade.pnl}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>📝</div>
                    <p>Connect wallet to start paper trading</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
