"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import TradingViewWidget from "@/components/TradingViewWidget";
import styles from "./dashboard.module.css";

// --- Types ---
type Strategy = "sma_crossover" | "rsi" | "bollinger" | "macd";
type Mode = "simulate" | "paper";
type SidebarTab = "params" | "crypto";

interface StrategyParams {
  sma_crossover: { fastPeriod: number; slowPeriod: number; stopLoss: number; takeProfit: number };
  rsi: { period: number; oversold: number; overbought: number; stopLoss: number; takeProfit: number };
  bollinger: { period: number; stdDev: number; stopLoss: number; takeProfit: number };
  macd: { fastPeriod: number; slowPeriod: number; signalPeriod: number; stopLoss: number; takeProfit: number };
}

interface Trade {
  id: number;
  type: "BUY" | "SELL";
  pair: string;
  time: string;
  pnl: string;
  profit: boolean;
  price: string;
}

interface CryptoAsset {
  symbol: string;
  name: string;
  tvSymbol: string;
  price: number;
  change: number;
}

const strategyLabels: Record<Strategy, string> = {
  sma_crossover: "SMA Crossover",
  rsi: "RSI",
  bollinger: "Bollinger Bands",
  macd: "MACD",
};

const strategyDescriptions: Record<Strategy, string> = {
  sma_crossover: "Crosses of fast/slow moving averages signal trend changes.",
  rsi: "Buys oversold conditions, sells overbought using momentum oscillator.",
  bollinger: "Mean-reversion using statistical price bands around a moving average.",
  macd: "Momentum using MACD line and signal line crossovers.",
};

const defaultParams: StrategyParams = {
  sma_crossover: { fastPeriod: 9, slowPeriod: 21, stopLoss: 2, takeProfit: 4 },
  rsi: { period: 14, oversold: 30, overbought: 70, stopLoss: 2, takeProfit: 4 },
  bollinger: { period: 20, stdDev: 2, stopLoss: 2, takeProfit: 4 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, stopLoss: 2, takeProfit: 4 },
};

const timeframes = ["1m", "5m", "15m", "1H", "4H", "1D"];

const cryptoAssets: CryptoAsset[] = [
  { symbol: "SUI", name: "Sui", tvSymbol: "BINANCE:SUIUSDT", price: 3.847, change: 2.14 },
  { symbol: "BTC", name: "Bitcoin", tvSymbol: "BINANCE:BTCUSDT", price: 67420.5, change: 1.32 },
  { symbol: "ETH", name: "Ethereum", tvSymbol: "BINANCE:ETHUSDT", price: 3521.8, change: -0.87 },
  { symbol: "SOL", name: "Solana", tvSymbol: "BINANCE:SOLUSDT", price: 178.4, change: 3.56 },
  { symbol: "BNB", name: "BNB", tvSymbol: "BINANCE:BNBUSDT", price: 596.2, change: 0.43 },
  { symbol: "AVAX", name: "Avalanche", tvSymbol: "BINANCE:AVAXUSDT", price: 38.91, change: -1.22 },
  { symbol: "DOGE", name: "Dogecoin", tvSymbol: "BINANCE:DOGEUSDT", price: 0.1612, change: 4.87 },
  { symbol: "ARB", name: "Arbitrum", tvSymbol: "BINANCE:ARBUSDT", price: 1.043, change: -2.41 },
];

function generateEquityCurve(length: number, winRate: number) {
  const points = [10000];
  for (let i = 1; i < length; i++) {
    const last = points[i - 1];
    const win = Math.random() < winRate;
    const delta = win
      ? last * (0.005 + Math.random() * 0.018)
      : -last * (0.003 + Math.random() * 0.012);
    points.push(Math.max(last + delta, 5000));
  }
  return points;
}

function formatTime() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function randomPnl(profit: boolean) {
  const val = (Math.random() * 3.5 + 0.2).toFixed(2);
  return profit ? `+${val}%` : `-${val}%`;
}

export default function DashboardPage() {
  const [mode, setMode] = useState<Mode>("simulate");
  const [strategy, setStrategy] = useState<Strategy>("sma_crossover");
  const [params, setParams] = useState(defaultParams);
  const [activeTimeframe, setActiveTimeframe] = useState("1H");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [simDone, setSimDone] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tvSymbol, setTvSymbol] = useState("BINANCE:SUIUSDT");
  const [livePrice, setLivePrice] = useState(3.847);
  const [priceDir, setPriceDir] = useState<"up" | "down" | null>(null);
  const [portfolio, setPortfolio] = useState(10247.83);
  const [winRate, setWinRate] = useState(64.3);
  const [totalTrades, setTotalTrades] = useState(127);
  const [sharpe, setSharpe] = useState(1.84);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("params");
  const tradeIdRef = useRef(200);
  const historyRef = useRef<HTMLDivElement>(null);

  const equityCurve = useMemo(() => generateEquityCurve(40, winRate / 100), [simDone, strategy]);

  // Live price ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setLivePrice((prev) => {
        const delta = (Math.random() - 0.49) * 0.06;
        const next = Math.max(prev + delta, 1);
        setPriceDir(next > prev ? "up" : "down");
        return parseFloat(next.toFixed(3));
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  // Clear price direction flash
  useEffect(() => {
    if (!priceDir) return;
    const t = setTimeout(() => setPriceDir(null), 600);
    return () => clearTimeout(t);
  }, [priceDir]);

  // Simulation runner
  const runSimulation = useCallback(() => {
    if (running) return;
    setRunning(true);
    setSimDone(false);
    setProgress(0);
    setTrades([]);

    const totalSteps = 20;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setProgress(Math.round((step / totalSteps) * 100));

      if (step % 3 === 0) {
        const isProfit = Math.random() < winRate / 100;
        const newTrade: Trade = {
          id: tradeIdRef.current++,
          type: Math.random() > 0.5 ? "BUY" : "SELL",
          pair: "SUI/USDC",
          time: formatTime(),
          pnl: randomPnl(isProfit),
          profit: isProfit,
          price: `$${(livePrice + (Math.random() - 0.5) * 0.2).toFixed(3)}`,
        };
        setTrades((prev) => [newTrade, ...prev].slice(0, 12));
        setTotalTrades((t) => t + 1);
        setPortfolio((p) => {
          const delta = isProfit
            ? p * (0.004 + Math.random() * 0.012)
            : -p * (0.002 + Math.random() * 0.008);
          return parseFloat((p + delta).toFixed(2));
        });
        setWinRate((w) => {
          const noise = (Math.random() - 0.5) * 0.8;
          return parseFloat(Math.min(Math.max(w + noise, 45), 80).toFixed(1));
        });
        setSharpe((s) => {
          const noise = (Math.random() - 0.5) * 0.05;
          return parseFloat(Math.max(s + noise, 0.8).toFixed(2));
        });
      }

      if (step >= totalSteps) {
        clearInterval(interval);
        setRunning(false);
        setSimDone(true);
      }
    }, 120);
  }, [running, winRate, livePrice]);

  const resetParams = () => {
    setParams(defaultParams);
    setSimDone(false);
    setTrades([]);
    setProgress(0);
  };

  const updateParam = (key: string, value: number) => {
    setParams((prev) => ({
      ...prev,
      [strategy]: { ...prev[strategy], [key]: value },
    }));
  };

  const currentParams = params[strategy];

  // Equity curve SVG path
  const eqMin = Math.min(...equityCurve);
  const eqMax = Math.max(...equityCurve);
  const eqRange = eqMax - eqMin || 1;
  const eqW = 100;
  const eqH = 60;
  const eqPoints = equityCurve.map((v, i) => {
    const x = (i / (equityCurve.length - 1)) * eqW;
    const y = eqH - ((v - eqMin) / eqRange) * eqH;
    return `${x},${y}`;
  });
  const eqPath = "M" + eqPoints.join(" L");
  const portfolioChange = ((portfolio - 10000) / 10000 * 100).toFixed(2);
  const portfolioUp = portfolio >= 10000;

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = 0;
  }, [trades.length]);

  const selectedAsset = cryptoAssets.find((a) => a.tvSymbol === tvSymbol);

  return (
    <>
      <Navbar />
      <div className={styles.dashboardLayout}>
        {/* Header */}
        <div className={styles.dashboardHeader}>
          <div className={styles.dashboardTitleRow}>
            <div className={styles.titleGroup}>
              <h1 className={styles.dashboardTitle}>Dashboard</h1>
              <span className={styles.liveDot} aria-label="Live data">
                <span className={styles.livePulse} />
                Live
              </span>
            </div>
            <div className={styles.dashboardMode}>
              <button
                className={`${styles.modeBtn} ${mode === "simulate" ? styles.modeBtnActive : ""}`}
                onClick={() => setMode("simulate")}
              >
                Simulate
              </button>
              <button
                className={`${styles.modeBtn} ${mode === "paper" ? styles.modeBtnActive : ""}`}
                onClick={() => setMode("paper")}
              >
                Paper Trade
              </button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Portfolio</span>
            <span className={`${styles.statValue} ${portfolioUp ? "profit" : "loss"}`}>
              ${portfolio.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`${styles.statChange} ${portfolioUp ? "profit" : "loss"}`}>
              {portfolioUp ? "+" : ""}{portfolioChange}%
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Win Rate</span>
            <span className={`${styles.statValue} profit`}>{winRate}%</span>
            <div className={styles.miniBar}>
              <div className={styles.miniBarFill} style={{ width: `${winRate}%` }} />
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Trades</span>
            <span className={styles.statValue}>{totalTrades}</span>
            <span className={styles.statChange} style={{ color: "var(--text-tertiary)" }}>Last 7 days</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Sharpe Ratio</span>
            <span className={`${styles.statValue} profit`}>{sharpe}</span>
            <span className={`${styles.statChange} ${sharpe >= 1.5 ? "profit" : "loss"}`}>
              {sharpe >= 2 ? "Excellent" : sharpe >= 1.5 ? "Good" : "Fair"}
            </span>
          </div>
        </div>

        {/* Main Content: chart 75% + sidebar 25% */}
        <div className={styles.mainContent}>

          {/* Chart Column */}
          <div className={styles.chartColumn}>
            <div className={styles.chartPanel}>
              <div className={styles.chartHeader}>
                <div className={styles.chartPair}>
                  <span
                    className={`${styles.chartPairPrice} ${
                      priceDir === "up" ? styles.priceUp : priceDir === "down" ? styles.priceDown : ""
                    }`}
                  >
                    {selectedAsset?.symbol ?? "SUI"} / USDT &nbsp;
                    ${livePrice.toFixed(3)}
                  </span>
                  <span className={`badge ${priceDir === "down" ? "badge-loss" : "badge-profit"}`}>
                    {priceDir === "down" ? "-" : "+"}0.16%
                  </span>
                </div>
                <div className={styles.chartTimeframes}>
                  {timeframes.map((tf) => (
                    <button
                      key={tf}
                      className={`${styles.timeframeBtn} ${tf === activeTimeframe ? styles.timeframeBtnActive : ""}`}
                      onClick={() => setActiveTimeframe(tf)}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.chartBody}>
                <TradingViewWidget
                  symbol={tvSymbol}
                  interval={
                    activeTimeframe === "1m" ? "1" :
                    activeTimeframe === "5m" ? "5" :
                    activeTimeframe === "15m" ? "15" :
                    activeTimeframe === "1H" ? "60" :
                    activeTimeframe === "4H" ? "240" : "D"
                  }
                  theme="dark"
                  height={420}
                />
              </div>
            </div>

            {/* Equity Curve */}
            {(simDone || trades.length > 0) && (
              <div className={styles.equityPanel}>
                <div className={styles.equityHeader}>
                  <span className={styles.equityTitle}>Equity Curve</span>
                  <span className={`badge ${portfolioUp ? "badge-profit" : "badge-loss"}`}>
                    {portfolioUp ? "+" : ""}{portfolioChange}% all time
                  </span>
                </div>
                <div className={styles.equityBody}>
                  <svg viewBox={`0 0 ${eqW} ${eqH}`} preserveAspectRatio="none" className={styles.equitySvg} aria-hidden="true">
                    <defs>
                      <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={portfolioUp ? "#22c55e" : "#ef4444"} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={portfolioUp ? "#22c55e" : "#ef4444"} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${eqPath} L${eqW},${eqH} L0,${eqH} Z`} fill="url(#eq-grad)" />
                    <path d={eqPath} fill="none" stroke={portfolioUp ? "#22c55e" : "#ef4444"} strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            )}

            {/* Recent Trades */}
            <div className={styles.historyPanel}>
              <div className={styles.historyHeader}>
                <span className={styles.historyTitle}>Recent Trades</span>
                {trades.length > 0 && <span className="badge badge-accent">{trades.length}</span>}
              </div>
              <div className={styles.historyBody} ref={historyRef}>
                {trades.length > 0 ? (
                  trades.map((trade) => (
                    <div className={`${styles.tradeRow} ${styles.tradeRowNew}`} key={trade.id}>
                      <div className={styles.tradeInfo}>
                        <span
                          className={styles.tradeType}
                          style={{ color: trade.type === "BUY" ? "var(--color-profit)" : "var(--color-loss)" }}
                        >
                          {trade.type} {trade.pair}
                        </span>
                        <span className={styles.tradeTime}>{trade.time} · {trade.price}</span>
                      </div>
                      <span className={styles.tradePnl} style={{ color: trade.profit ? "var(--color-profit)" : "var(--color-loss)" }}>
                        {trade.pnl}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                      <circle cx="14" cy="14" r="12" stroke="var(--border-hover)" strokeWidth="1.5" />
                      <path d="M10 14L13 17L18 11" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p>{mode === "simulate" ? "Run a simulation to see trades" : "Connect wallet to start paper trading"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar — 25% */}
          <div className={styles.sidebar}>
            {/* Tab Bar */}
            <div className={styles.sidebarTabs}>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === "params" ? styles.sidebarTabActive : ""}`}
                onClick={() => setSidebarTab("params")}
              >
                Parameters
              </button>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === "crypto" ? styles.sidebarTabActive : ""}`}
                onClick={() => setSidebarTab("crypto")}
              >
                Crypto
              </button>
            </div>

            {/* Parameters Tab */}
            {sidebarTab === "params" && (
              <div className={styles.sidebarContent}>
                {/* Strategy selector */}
                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>Strategy</label>
                  <select
                    className={styles.strategySelect}
                    value={strategy}
                    onChange={(e) => {
                      setStrategy(e.target.value as Strategy);
                      setSimDone(false);
                      setTrades([]);
                    }}
                  >
                    {Object.entries(strategyLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <p className={styles.strategyDesc}>{strategyDescriptions[strategy]}</p>
                </div>

                <div className={styles.paramDivider} />

                {/* Strategy-specific params */}
                {strategy === "sma_crossover" && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Fast Period <span className={styles.paramValue}>{(currentParams as typeof defaultParams.sma_crossover).fastPeriod}</span>
                      </label>
                      <input type="range" className="slider" min="3" max="50"
                        value={(currentParams as typeof defaultParams.sma_crossover).fastPeriod}
                        onChange={(e) => updateParam("fastPeriod", +e.target.value)} />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Slow Period <span className={styles.paramValue}>{(currentParams as typeof defaultParams.sma_crossover).slowPeriod}</span>
                      </label>
                      <input type="range" className="slider" min="10" max="200"
                        value={(currentParams as typeof defaultParams.sma_crossover).slowPeriod}
                        onChange={(e) => updateParam("slowPeriod", +e.target.value)} />
                    </div>
                  </>
                )}

                {strategy === "rsi" && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        RSI Period <span className={styles.paramValue}>{(currentParams as typeof defaultParams.rsi).period}</span>
                      </label>
                      <input type="range" className="slider" min="5" max="50"
                        value={(currentParams as typeof defaultParams.rsi).period}
                        onChange={(e) => updateParam("period", +e.target.value)} />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Oversold <span className={styles.paramValue}>{(currentParams as typeof defaultParams.rsi).oversold}</span>
                      </label>
                      <input type="range" className="slider" min="10" max="40"
                        value={(currentParams as typeof defaultParams.rsi).oversold}
                        onChange={(e) => updateParam("oversold", +e.target.value)} />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Overbought <span className={styles.paramValue}>{(currentParams as typeof defaultParams.rsi).overbought}</span>
                      </label>
                      <input type="range" className="slider" min="60" max="90"
                        value={(currentParams as typeof defaultParams.rsi).overbought}
                        onChange={(e) => updateParam("overbought", +e.target.value)} />
                    </div>
                  </>
                )}

                {strategy === "bollinger" && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Period <span className={styles.paramValue}>{(currentParams as typeof defaultParams.bollinger).period}</span>
                      </label>
                      <input type="range" className="slider" min="5" max="50"
                        value={(currentParams as typeof defaultParams.bollinger).period}
                        onChange={(e) => updateParam("period", +e.target.value)} />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Std Dev <span className={styles.paramValue}>{(currentParams as typeof defaultParams.bollinger).stdDev}</span>
                      </label>
                      <input type="range" className="slider" min="1" max="4" step="0.5"
                        value={(currentParams as typeof defaultParams.bollinger).stdDev}
                        onChange={(e) => updateParam("stdDev", +e.target.value)} />
                    </div>
                  </>
                )}

                {strategy === "macd" && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Fast Period <span className={styles.paramValue}>{(currentParams as typeof defaultParams.macd).fastPeriod}</span>
                      </label>
                      <input type="range" className="slider" min="5" max="30"
                        value={(currentParams as typeof defaultParams.macd).fastPeriod}
                        onChange={(e) => updateParam("fastPeriod", +e.target.value)} />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Slow Period <span className={styles.paramValue}>{(currentParams as typeof defaultParams.macd).slowPeriod}</span>
                      </label>
                      <input type="range" className="slider" min="15" max="50"
                        value={(currentParams as typeof defaultParams.macd).slowPeriod}
                        onChange={(e) => updateParam("slowPeriod", +e.target.value)} />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>
                        Signal Period <span className={styles.paramValue}>{(currentParams as typeof defaultParams.macd).signalPeriod}</span>
                      </label>
                      <input type="range" className="slider" min="3" max="20"
                        value={(currentParams as typeof defaultParams.macd).signalPeriod}
                        onChange={(e) => updateParam("signalPeriod", +e.target.value)} />
                    </div>
                  </>
                )}

                <div className={styles.paramDivider} />

                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>
                    Stop Loss <span className={styles.paramValue} style={{ color: "var(--color-loss)" }}>{currentParams.stopLoss}%</span>
                  </label>
                  <input type="range" className="slider" min="0.5" max="10" step="0.5"
                    value={currentParams.stopLoss}
                    onChange={(e) => updateParam("stopLoss", +e.target.value)} />
                </div>
                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>
                    Take Profit <span className={styles.paramValue} style={{ color: "var(--color-profit)" }}>{currentParams.takeProfit}%</span>
                  </label>
                  <input type="range" className="slider" min="1" max="20" step="0.5"
                    value={currentParams.takeProfit}
                    onChange={(e) => updateParam("takeProfit", +e.target.value)} />
                </div>

                {running && (
                  <div className={styles.progressGroup}>
                    <div className={styles.progressLabel}>
                      <span>Running simulation...</span>
                      <span className={styles.progressPct}>{progress}%</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {simDone && (
                  <div className={styles.simResult}>
                    Simulation complete — {trades.length} signals generated
                  </div>
                )}

                <div className={styles.paramActions}>
                  <button
                    className={`btn btn-primary ${running ? styles.btnRunning : ""}`}
                    style={{ width: "100%" }}
                    onClick={mode === "simulate" ? runSimulation : undefined}
                    disabled={running}
                  >
                    {running ? "Running..." : mode === "simulate" ? "Run Simulation" : "Start Paper Trading"}
                  </button>
                  <button className="btn btn-secondary" style={{ width: "100%" }} onClick={resetParams}>
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Crypto Tab */}
            {sidebarTab === "crypto" && (
              <div className={styles.sidebarContent}>
                <p className={styles.cryptoHint}>Select a pair to load it in the chart.</p>
                <div className={styles.cryptoList}>
                  {cryptoAssets.map((asset) => (
                    <button
                      key={asset.symbol}
                      className={`${styles.cryptoRow} ${tvSymbol === asset.tvSymbol ? styles.cryptoRowActive : ""}`}
                      onClick={() => setTvSymbol(asset.tvSymbol)}
                    >
                      <div className={styles.cryptoRowLeft}>
                        <span className={styles.cryptoSymbol}>{asset.symbol}</span>
                        <span className={styles.cryptoName}>{asset.name}</span>
                      </div>
                      <div className={styles.cryptoRowRight}>
                        <span className={styles.cryptoPrice}>
                          ${asset.price < 1 ? asset.price.toFixed(4) : asset.price.toLocaleString()}
                        </span>
                        <span className={`${styles.cryptoChange} ${asset.change >= 0 ? "profit" : "loss"}`}>
                          {asset.change >= 0 ? "+" : ""}{asset.change}%
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className={styles.paramDivider} />

                <div className={styles.quickLinks}>
                  <Link href="/simulate" className={styles.quickLink}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M2 9L5 6L8 8L12 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Full Backtest
                  </Link>
                  <Link href="/reports" className={styles.quickLink}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M5 5H9M5 8H9M5 11H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    AI Report
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
