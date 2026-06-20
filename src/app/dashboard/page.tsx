"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SimulatedChart, { computeSignals, type Candle } from "@/components/SimulatedChart";
import CryptoTab from "@/components/CryptoTab";
import TickerSearch from "@/components/TickerSearch";
import styles from "./dashboard.module.css";

// --- Types ---
type Strategy = "sma_crossover" | "rsi" | "bollinger" | "macd";
type Mode = "simulate" | "paper";
type SidebarTab = "params" | "crypto" | "live";

interface StockData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface LiveData {
  symbol: string;
  name: string;
  currentPrice: number;
  currency: string;
  period: string;
  data: StockData[];
}

const periodOptions: { value: string; label: string; short: string }[] = [
  { value: "1mo", label: "1 Month", short: "1M" },
  { value: "3mo", label: "3 Months", short: "3M" },
  { value: "6mo", label: "6 Months", short: "6M" },
  { value: "1y", label: "1 Year", short: "1Y" },
  { value: "2y", label: "2 Years", short: "2Y" },
  { value: "5y", label: "5 Years", short: "5Y" },
];

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

// A completed round-trip trade derived from real market signals (live market)
interface LiveTrade {
  id: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  profit: boolean;
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

export default function DashboardPage() {
  const [mode] = useState<Mode>("simulate");
  const [strategy, setStrategy] = useState<Strategy>("sma_crossover");
  const [params, setParams] = useState(defaultParams);
  // Strategy switcher: swap to a fallback strategy when price drops below threshold
  const [switchEnabled, setSwitchEnabled] = useState(false);
  const [switchThreshold, setSwitchThreshold] = useState(3.8);
  const [switchStrategy, setSwitchStrategy] = useState<Strategy>("rsi");
  const [activeTimeframe, setActiveTimeframe] = useState("1H");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [simDone, setSimDone] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [allPnls, setAllPnls] = useState<number[]>([]);
  const [tvSymbol, setTvSymbol] = useState("BINANCE:SUIUSDT");
  const [pairLabel, setPairLabel] = useState("SIM / USD");
  const [livePrice, setLivePrice] = useState(3.847);
  const [priceDir, setPriceDir] = useState<"up" | "down" | null>(null);
  const [portfolio, setPortfolio] = useState(10247.83);
  const [winRate, setWinRate] = useState(64.3);
  const [totalTrades, setTotalTrades] = useState(127);
  const [sharpe, setSharpe] = useState(1.84);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("params");
  const [chartSeed, setChartSeed] = useState(0);
  const tradeIdRef = useRef(200);
  const historyRef = useRef<HTMLDivElement>(null);

  // Live Market state
  const [ticker, setTicker] = useState("AAPL");
  const [period, setPeriod] = useState("6mo");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [liveAlgo, setLiveAlgo] = useState(false);

  const handleLoadData = useCallback(async (periodOverride?: string, symbolOverride?: string) => {
    const symbol = (symbolOverride ?? ticker).trim().toUpperCase();
    if (!symbol) {
      setLiveError("Enter a ticker symbol.");
      return;
    }
    const usePeriod = periodOverride ?? period;
    if (periodOverride) setPeriod(periodOverride);
    setLiveLoading(true);
    setLiveError(null);
    try {
      const res = await fetch(
        `/api/stock?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(usePeriod)}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load data.");
      }
      setLiveData(json as LiveData);
    } catch (err) {
      setLiveError((err as Error).message);
    } finally {
      setLiveLoading(false);
    }
  }, [ticker, period]);

  // Convert real OHLCV market data into candle format for the chart
  const liveCandles = useMemo<Candle[] | undefined>(() => {
    if (!liveData) return undefined;
    return liveData.data.map((d) => ({
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
      t: new Date(d.time).getTime(),
    }));
  }, [liveData]);

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
    setAllPnls([]);

    const totalSteps = 20;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setProgress(Math.round((step / totalSteps) * 100));

      if (step % 3 === 0) {
        const isProfit = Math.random() < winRate / 100;
        const pnlValue = parseFloat((Math.random() * 3.5 + 0.2).toFixed(2)) * (isProfit ? 1 : -1);
        const newTrade: Trade = {
          id: tradeIdRef.current++,
          type: Math.random() > 0.5 ? "BUY" : "SELL",
          pair: "SIM/USD",
          time: formatTime(),
          pnl: `${pnlValue >= 0 ? "+" : ""}${pnlValue.toFixed(2)}%`,
          profit: isProfit,
          price: `$${(livePrice + (Math.random() - 0.5) * 0.2).toFixed(3)}`,
        };
        setTrades((prev) => [newTrade, ...prev].slice(0, 12));
        setAllPnls((prev) => [...prev, pnlValue]);
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
    setAllPnls([]);
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

  // Live market price chart
  const fmtPrice = (v: number, currency: string) =>
    `${currency === "USD" ? "$" : ""}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency !== "USD" ? ` ${currency}` : ""}`;

  // Performance metrics derived from completed trades + equity curve
  const metrics = useMemo(() => {
    const wins = allPnls.filter((p) => p > 0);
    const losses = allPnls.filter((p) => p < 0);
    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

    // Max drawdown from the equity curve (peak-to-trough)
    let peak = equityCurve[0] ?? 10000;
    let maxDd = 0;
    for (const v of equityCurve) {
      if (v > peak) peak = v;
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }

    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;

    return {
      netReturn: parseFloat(portfolioChange),
      maxDrawdown: maxDd * 100,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      winningTrades: wins.length,
      losingTrades: losses.length,
      avgWin,
      avgLoss,
      bestTrade: allPnls.length ? Math.max(...allPnls) : 0,
      worstTrade: allPnls.length ? Math.min(...allPnls) : 0,
    };
  }, [allPnls, equityCurve, portfolioChange]);

  // Buy/sell signals from the strategy applied to real market data
  const liveSignals = useMemo(() => {
    if (!liveData || !liveAlgo || !liveCandles || liveCandles.length === 0) return [];
    return computeSignals(
      strategy,
      liveCandles.map((c) => c.close),
      currentParams as unknown as Record<string, number>,
      { switchEnabled, switchThreshold, switchStrategy }
    );
  }, [liveData, liveAlgo, liveCandles, strategy, currentParams, switchEnabled, switchThreshold, switchStrategy]);

  // Pair signals into completed round-trip trades (buy -> next sell) with PnL
  const liveTrades = useMemo<LiveTrade[]>(() => {
    if (!liveCandles || liveSignals.length === 0) return [];
    const result: LiveTrade[] = [];
    let entry: { i: number; price: number } | null = null;
    let id = 1;
    for (const sig of liveSignals) {
      const candle = liveCandles[sig.i];
      if (!candle) continue;
      if (sig.side === "buy") {
        if (!entry) entry = { i: sig.i, price: candle.close };
      } else if (entry) {
        const pnl = ((candle.close - entry.price) / entry.price) * 100;
        result.push({
          id: id++,
          entryPrice: entry.price,
          exitPrice: candle.close,
          entryTime: liveCandles[entry.i]?.t ?? candle.t,
          exitTime: candle.t,
          pnl,
          profit: pnl >= 0,
        });
        entry = null;
      }
    }
    return result.reverse(); // most recent first
  }, [liveCandles, liveSignals]);

  // Performance metrics from completed live round-trip trades
  const liveMetrics = useMemo(() => {
    const pnls = liveTrades.map((t) => t.pnl);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const grossProfit = wins.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));

    // Compounded net return across the round trips
    const netReturn = (liveTrades.reduce((acc, t) => acc * (1 + t.pnl / 100), 1) - 1) * 100;

    // Max drawdown from the compounded equity curve (oldest -> newest)
    let equity = 1;
    let peak = 1;
    let maxDd = 0;
    for (let i = liveTrades.length - 1; i >= 0; i--) {
      equity *= 1 + liveTrades[i].pnl / 100;
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }

    return {
      netReturn,
      maxDrawdown: maxDd * 100,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      winningTrades: wins.length,
      losingTrades: losses.length,
      avgWin: wins.length ? grossProfit / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      bestTrade: pnls.length ? Math.max(...pnls) : 0,
      worstTrade: pnls.length ? Math.min(...pnls) : 0,
      winRate: pnls.length ? (wins.length / pnls.length) * 100 : 0,
    };
  }, [liveTrades]);

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = 0;
  }, [trades.length]);

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
          </div>
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
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
                {liveData ? (
                  <>
                    <div className={styles.chartPair}>
                      <span className={styles.chartPairPrice}>
                        {liveData.symbol} &nbsp;
                        {fmtPrice(liveData.currentPrice, liveData.currency)}
                      </span>
                      {(() => {
                        const first = liveData.data[0]?.close ?? 0;
                        const last = liveData.data[liveData.data.length - 1]?.close ?? 0;
                        const chg = first ? ((last - first) / first) * 100 : 0;
                        return (
                          <span className={`badge ${chg >= 0 ? "badge-profit" : "badge-loss"}`}>
                            {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                          </span>
                        );
                      })()}
                      <span className={styles.liveTag}>{liveData.name}</span>
                    </div>
                    <div className={styles.chartTimeframes}>
                      {periodOptions.map((p) => (
                        <button
                          key={p.value}
                          className={`${styles.timeframeBtn} ${p.value === period ? styles.timeframeBtnActive : ""}`}
                          onClick={() => handleLoadData(p.value)}
                          disabled={liveLoading}
                          title={p.label}
                        >
                          {p.short}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.chartPair}>
                      <span
                        className={`${styles.chartPairPrice} ${
                          priceDir === "up" ? styles.priceUp : priceDir === "down" ? styles.priceDown : ""
                        }`}
                      >
                        {pairLabel} &nbsp;
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
                      <button
                        className={styles.newDataBtn}
                        onClick={() => setChartSeed((s) => s + 1)}
                        title="Generate a new set of simulated data"
                      >
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path d="M12 7a5 5 0 1 1-1.46-3.54" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        New Data
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className={styles.chartBody}>
                {liveData ? (
                  <div className={styles.liveChartWrap}>
                    <div className={styles.priceMeta}>
                      <div className={styles.priceMetaItem}>
                        <span className={styles.priceMetaLabel}>Last</span>
                        <span className={styles.priceMetaValue}>{fmtPrice(liveData.currentPrice, liveData.currency)}</span>
                      </div>
                      <div className={styles.priceMetaItem}>
                        <span className={styles.priceMetaLabel}>High</span>
                        <span className={styles.priceMetaValue}>{fmtPrice(Math.max(...liveData.data.map((d) => d.high)), liveData.currency)}</span>
                      </div>
                      <div className={styles.priceMetaItem}>
                        <span className={styles.priceMetaLabel}>Low</span>
                        <span className={styles.priceMetaValue}>{fmtPrice(Math.min(...liveData.data.map((d) => d.low)), liveData.currency)}</span>
                      </div>
                      <div className={styles.priceMetaItem}>
                        <span className={styles.priceMetaLabel}>Candles</span>
                        <span className={styles.priceMetaValue}>{liveData.data.length}</span>
                      </div>
                    </div>
                    <div className={styles.priceChartBody}>
                      <SimulatedChart
                        timeframe="1D"
                        staticCandles={liveCandles}
                        strategy={strategy}
                        showAlgo={liveAlgo}
                        params={currentParams as unknown as Record<string, number>}
                        switchEnabled={switchEnabled}
                        switchThreshold={switchThreshold}
                        switchStrategy={switchStrategy}
                        ariaLabel={`${liveData.symbol} candlestick chart`}
                      />
                    </div>
                  </div>
                ) : (
                  <SimulatedChart
                    timeframe={activeTimeframe}
                    basePrice={livePrice}
                    regenKey={chartSeed}
                    strategy={strategy}
                    showAlgo={running || simDone}
                    params={currentParams as unknown as Record<string, number>}
                    switchEnabled={switchEnabled}
                    switchThreshold={switchThreshold}
                    switchStrategy={switchStrategy}
                  />
                )}
              </div>
            </div>

            {/* Equity Curve */}
            {!liveData && (simDone || trades.length > 0) && (
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

            {/* Performance Metrics */}
            {!liveData && simDone && allPnls.length > 0 && (
              <div className={styles.metricsPanel}>
                <div className={styles.metricsHeader}>
                  <span className={styles.metricsTitle}>Performance Metrics</span>
                  <span className="badge badge-accent">{strategyLabels[strategy]}</span>
                </div>
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Net Return</span>
                    <span className={`${styles.metricValue} ${metrics.netReturn >= 0 ? "profit" : "loss"}`}>
                      {metrics.netReturn >= 0 ? "+" : ""}{metrics.netReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Max Drawdown</span>
                    <span className={`${styles.metricValue} loss`}>-{metrics.maxDrawdown.toFixed(2)}%</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Profit Factor</span>
                    <span className={`${styles.metricValue} ${metrics.profitFactor >= 1 ? "profit" : "loss"}`}>
                      {metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2)}
                    </span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Win / Loss</span>
                    <span className={styles.metricValue}>
                      <span className="profit">{metrics.winningTrades}W</span>
                      {" / "}
                      <span className="loss">{metrics.losingTrades}L</span>
                    </span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Avg Win</span>
                    <span className={`${styles.metricValue} profit`}>+{metrics.avgWin.toFixed(2)}%</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Avg Loss</span>
                    <span className={`${styles.metricValue} loss`}>-{metrics.avgLoss.toFixed(2)}%</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Best Trade</span>
                    <span className={`${styles.metricValue} profit`}>+{metrics.bestTrade.toFixed(2)}%</span>
                  </div>
                  <div className={styles.metricCard}>
                    <span className={styles.metricLabel}>Worst Trade</span>
                    <span className={`${styles.metricValue} loss`}>{metrics.worstTrade.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Trades */}
            {!liveData && (
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
            )}

            {/* Live Market — Performance Metrics (strategy applied) */}
            {liveData && liveAlgo && (
              <div className={styles.metricsPanel}>
                <div className={styles.metricsHeader}>
                  <span className={styles.metricsTitle}>Performance Metrics</span>
                  <span className="badge badge-accent">{strategyLabels[strategy]}</span>
                </div>
                {liveTrades.length > 0 ? (
                  <div className={styles.metricsGrid}>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Net Return</span>
                      <span className={`${styles.metricValue} ${liveMetrics.netReturn >= 0 ? "profit" : "loss"}`}>
                        {liveMetrics.netReturn >= 0 ? "+" : ""}{liveMetrics.netReturn.toFixed(2)}%
                      </span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Win Rate</span>
                      <span className={`${styles.metricValue} ${liveMetrics.winRate >= 50 ? "profit" : "loss"}`}>
                        {liveMetrics.winRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Max Drawdown</span>
                      <span className={`${styles.metricValue} loss`}>-{liveMetrics.maxDrawdown.toFixed(2)}%</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Profit Factor</span>
                      <span className={`${styles.metricValue} ${liveMetrics.profitFactor >= 1 ? "profit" : "loss"}`}>
                        {liveMetrics.profitFactor === Infinity ? "∞" : liveMetrics.profitFactor.toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Win / Loss</span>
                      <span className={styles.metricValue}>
                        <span className="profit">{liveMetrics.winningTrades}W</span>
                        {" / "}
                        <span className="loss">{liveMetrics.losingTrades}L</span>
                      </span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Avg Win</span>
                      <span className={`${styles.metricValue} profit`}>+{liveMetrics.avgWin.toFixed(2)}%</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Best Trade</span>
                      <span className={`${styles.metricValue} profit`}>+{liveMetrics.bestTrade.toFixed(2)}%</span>
                    </div>
                    <div className={styles.metricCard}>
                      <span className={styles.metricLabel}>Worst Trade</span>
                      <span className={`${styles.metricValue} loss`}>{liveMetrics.worstTrade.toFixed(2)}%</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                      <circle cx="14" cy="14" r="12" stroke="var(--border-hover)" strokeWidth="1.5" />
                      <path d="M10 14L13 17L18 11" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p>
                      {liveSignals.length > 0
                        ? `${liveSignals.length} signal${liveSignals.length === 1 ? "" : "s"} generated — no completed round-trip trades yet`
                        : "No signals generated for this strategy on the selected range"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Live Market — Recent Trades (strategy applied) */}
            {liveData && liveAlgo && (
              <div className={styles.historyPanel}>
                <div className={styles.historyHeader}>
                  <span className={styles.historyTitle}>Recent Trades</span>
                  {liveTrades.length > 0 && <span className="badge badge-accent">{liveTrades.length}</span>}
                </div>
                <div className={styles.historyBody}>
                  {liveTrades.length > 0 ? (
                    liveTrades.map((trade) => (
                      <div className={styles.tradeRow} key={trade.id}>
                        <div className={styles.tradeInfo}>
                          <span
                            className={styles.tradeType}
                            style={{ color: trade.profit ? "var(--color-profit)" : "var(--color-loss)" }}
                          >
                            LONG {liveData.symbol}
                          </span>
                          <span className={styles.tradeTime}>
                            {new Date(trade.exitTime).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            {" · "}
                            {fmtPrice(trade.entryPrice, liveData.currency)} → {fmtPrice(trade.exitPrice, liveData.currency)}
                          </span>
                        </div>
                        <span className={styles.tradePnl} style={{ color: trade.profit ? "var(--color-profit)" : "var(--color-loss)" }}>
                          {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                        <circle cx="14" cy="14" r="12" stroke="var(--border-hover)" strokeWidth="1.5" />
                        <path d="M10 14L13 17L18 11" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p>No completed trades — adjust the strategy or time range</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — 25% */}
          <div className={styles.sidebar}>
            {/* Tab Bar */}
            <div className={styles.sidebarTabs}>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === "params" ? styles.sidebarTabActive : ""}`}
                onClick={() => {
                  setSidebarTab("params");
                  setLiveData(null);
                }}
              >
                Simulation
              </button>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === "crypto" ? styles.sidebarTabActive : ""}`}
                onClick={() => setSidebarTab("crypto")}
              >
                Crypto
              </button>
              <button
                className={`${styles.sidebarTab} ${sidebarTab === "live" ? styles.sidebarTabActive : ""}`}
                onClick={() => setSidebarTab("live")}
              >
                Live Market
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
                      const next = e.target.value as Strategy;
                      setStrategy(next);
                      // Keep the fallback strategy distinct from the primary
                      if (switchStrategy === next) {
                        const alt = (Object.keys(strategyLabels) as Strategy[]).find((k) => k !== next);
                        if (alt) setSwitchStrategy(alt);
                      }
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

                <div className={styles.paramDivider} />

                {/* Strategy Switcher */}
                <div className={styles.paramGroup}>
                  <label className={styles.switchRow}>
                    <span className={styles.paramLabel} style={{ margin: 0 }}>Strategy Switcher</span>
                    <input
                      type="checkbox"
                      className={styles.switchToggle}
                      checked={switchEnabled}
                      onChange={(e) => setSwitchEnabled(e.target.checked)}
                    />
                  </label>
                  <p className={styles.strategyDesc}>
                    Swap to a fallback strategy when price drops below a set threshold.
                  </p>
                </div>

                {switchEnabled && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel} htmlFor="switchThreshold">
                        Threshold Price
                      </label>
                      <input
                        id="switchThreshold"
                        type="number"
                        step="0.01"
                        className={styles.tickerInput}
                        value={switchThreshold}
                        onChange={(e) => setSwitchThreshold(+e.target.value)}
                      />
                    </div>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>Fallback Strategy</label>
                      <select
                        className={styles.strategySelect}
                        value={switchStrategy}
                        onChange={(e) => setSwitchStrategy(e.target.value as Strategy)}
                      >
                        {Object.entries(strategyLabels)
                          .filter(([key]) => key !== strategy)
                          .map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                      </select>
                      <p className={styles.strategyDesc}>
                        Below {switchThreshold}, the chart uses {strategyLabels[switchStrategy]} instead of {strategyLabels[strategy]}.
                      </p>
                    </div>
                  </>
                )}

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
                <CryptoTab
                  activeSymbol={tvSymbol}
                  onSelect={(coin) => {
                    setTvSymbol(coin.symbol);
                    setPairLabel(coin.name);
                  }}
                />

                <div className={styles.paramDivider} />

                <div className={styles.quickLinks}>
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

            {/* Live Market Tab */}
            {sidebarTab === "live" && (
              <div className={styles.sidebarContent}>
                <p className={styles.cryptoHint}>
                  Load real historical market data for any stock ticker.
                </p>

                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel} htmlFor="ticker">Ticker symbol</label>
                  <TickerSearch
                    value={ticker}
                    onChange={setTicker}
                    onSelect={(symbol) => {
                      setTicker(symbol);
                      handleLoadData(undefined, symbol);
                    }}
                    disabled={liveLoading}
                  />
                </div>

                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel} htmlFor="period">Time period</label>
                  <select
                    id="period"
                    className={styles.strategySelect}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    {periodOptions.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  className={`btn btn-primary ${liveLoading ? styles.btnRunning : ""}`}
                  style={{ width: "100%" }}
                  onClick={() => handleLoadData()}
                  disabled={liveLoading}
                >
                  {liveLoading ? "Loading…" : "Load Data"}
                </button>

                {liveLoading && (
                  <div className={styles.liveStatus}>
                    <div className={styles.liveSpinner} />
                    <span>Fetching market data…</span>
                  </div>
                )}

                {liveError && !liveLoading && (
                  <div className={styles.liveError}>{liveError}</div>
                )}

                {liveData && !liveLoading && (
                  <>
                    <div className={styles.paramDivider} />

                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>Trading strategy</label>
                      <select
                        className={styles.strategySelect}
                        value={strategy}
                        onChange={(e) => {
                          const next = e.target.value as Strategy;
                          setStrategy(next);
                          // Keep the fallback strategy distinct from the primary
                          if (switchStrategy === next) {
                            const alt = (Object.keys(strategyLabels) as Strategy[]).find((k) => k !== next);
                            if (alt) setSwitchStrategy(alt);
                          }
                        }}
                      >
                        {Object.entries(strategyLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                      <p className={styles.strategyDesc}>{strategyDescriptions[strategy]}</p>
                    </div>

                    <div className={styles.paramDivider} />

                    {/* Strategy Switcher */}
                    <div className={styles.paramGroup}>
                      <label className={styles.switchRow}>
                        <span className={styles.paramLabel} style={{ margin: 0 }}>Strategy Switcher</span>
                        <input
                          type="checkbox"
                          className={styles.switchToggle}
                          checked={switchEnabled}
                          onChange={(e) => setSwitchEnabled(e.target.checked)}
                        />
                      </label>
                      <p className={styles.strategyDesc}>
                        Swap to a fallback strategy when price drops below a set threshold.
                      </p>
                    </div>

                    {switchEnabled && (
                      <>
                        <div className={styles.paramGroup}>
                          <label className={styles.paramLabel} htmlFor="liveSwitchThreshold">
                            Threshold Price
                          </label>
                          <input
                            id="liveSwitchThreshold"
                            type="number"
                            step="0.01"
                            className={styles.tickerInput}
                            value={switchThreshold}
                            onChange={(e) => setSwitchThreshold(+e.target.value)}
                          />
                        </div>
                        <div className={styles.paramGroup}>
                          <label className={styles.paramLabel}>Fallback Strategy</label>
                          <select
                            className={styles.strategySelect}
                            value={switchStrategy}
                            onChange={(e) => setSwitchStrategy(e.target.value as Strategy)}
                          >
                            {Object.entries(strategyLabels)
                              .filter(([key]) => key !== strategy)
                              .map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                          </select>
                          <p className={styles.strategyDesc}>
                            Below {switchThreshold}, the chart uses {strategyLabels[switchStrategy]} instead of {strategyLabels[strategy]}.
                          </p>
                        </div>
                      </>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ width: "100%" }}
                      onClick={() => setLiveAlgo((v) => !v)}
                    >
                      {liveAlgo ? "Hide Strategy Overlay" : "Run Strategy on Chart"}
                    </button>

                    {liveAlgo && (
                      <div className={styles.simResult}>
                        {strategyLabels[strategy]} applied to {liveData.symbol}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
