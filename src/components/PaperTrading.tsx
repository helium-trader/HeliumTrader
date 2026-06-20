"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import SimulatedChart, { type Candle } from "@/components/SimulatedChart";
import TickerSearch from "@/components/TickerSearch";
import EodReview, { type EodPayload } from "@/components/EodReview";
import { fetchKlines, fetchTicker, fetchSpotTickers, type CryptoMarket } from "@/lib/bybit";
import { evaluateStance, type StrategyId, type StrategyParams } from "@/lib/strategy";
import {
  getPaperState,
  executeTrade,
  resetPaperAccount,
  type PaperState,
  type Market,
} from "@/app/actions/paper";
import styles from "@/app/paper/paper.module.css";

interface Instrument {
  symbol: string;
  name: string;
}

const cryptoTimeframes = ["5m", "15m", "1H", "4H", "1D"] as const;
const stockPeriods = [
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
] as const;

const strategyLabels: Record<StrategyId, string> = {
  sma_crossover: "SMA Crossover",
  rsi: "RSI",
  bollinger: "Bollinger Bands",
  macd: "MACD",
};

const defaultParams: Record<StrategyId, StrategyParams> = {
  sma_crossover: { fastPeriod: 9, slowPeriod: 21, stopLoss: 3, takeProfit: 6 },
  rsi: { period: 14, oversold: 30, overbought: 70, stopLoss: 3, takeProfit: 6 },
  bollinger: { period: 20, stdDev: 2, stopLoss: 3, takeProfit: 6 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, stopLoss: 3, takeProfit: 6 },
};

// Tunable indicator inputs per strategy, rendered as sliders in the engine card.
interface ParamControl {
  key: keyof StrategyParams;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

const strategyParamControls: Record<StrategyId, ParamControl[]> = {
  sma_crossover: [
    { key: "fastPeriod", label: "Fast MA period", min: 2, max: 50, step: 1 },
    { key: "slowPeriod", label: "Slow MA period", min: 5, max: 120, step: 1 },
  ],
  rsi: [
    { key: "period", label: "RSI period", min: 2, max: 50, step: 1 },
    { key: "oversold", label: "Oversold level", min: 5, max: 45, step: 1 },
    { key: "overbought", label: "Overbought level", min: 55, max: 95, step: 1 },
  ],
  bollinger: [
    { key: "period", label: "Period", min: 5, max: 60, step: 1 },
    { key: "stdDev", label: "Std deviations", min: 1, max: 4, step: 0.1, suffix: "σ" },
  ],
  macd: [
    { key: "fastPeriod", label: "Fast EMA", min: 2, max: 30, step: 1 },
    { key: "slowPeriod", label: "Slow EMA", min: 10, max: 60, step: 1 },
    { key: "signalPeriod", label: "Signal EMA", min: 2, max: 20, step: 1 },
  ],
};

const DEFAULTS: Record<Market, Instrument> = {
  crypto: { symbol: "BTCUSDT", name: "BTC / USDT" },
  stock: { symbol: "AAPL", name: "Apple Inc." },
};

function fmtUsd(v: number, max = 2) {
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: max,
  });
}

function fmtPrice(v: number) {
  if (!Number.isFinite(v) || v === 0) return "—";
  if (v < 1) return `$${v.toFixed(5)}`;
  if (v < 1000) return `$${v.toFixed(2)}`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export default function PaperTrading() {
  const [market, setMarket] = useState<Market>("crypto");
  const [instrument, setInstrument] = useState<Instrument>(DEFAULTS.crypto);
  const [stockQuery, setStockQuery] = useState("AAPL");
  const [cryptoQuery, setCryptoQuery] = useState("");
  const [timeframe, setTimeframe] = useState<string>("1H");
  const [stockPeriod, setStockPeriod] = useState<string>("1mo");

  const [candles, setCandles] = useState<Candle[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Live mark prices for every symbol we care about (positions + selected).
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Trading method: the user picks one of manual OR algorithmic, never both.
  const [tradeMode, setTradeMode] = useState<"manual" | "algo">("manual");

  // Manual trade controls
  const [qtyInput, setQtyInput] = useState("");
  const [tradeMsg, setTradeMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Strategy engine
  const [strategy, setStrategy] = useState<StrategyId>("sma_crossover");
  const [params, setParams] = useState(defaultParams);
  const [engineOn, setEngineOn] = useState(false);
  const [allocation, setAllocation] = useState(25); // % of cash per entry
  const [engineLog, setEngineLog] = useState<string[]>([]);
  const engineBusyRef = useRef(false);

  const livePrice = prices[instrument.symbol] ?? 0;

  // ---- Paper account state (server) ----
  const { data: paper, mutate } = useSWR<PaperState>(
    ["paper", market],
    () => getPaperState(market),
    { revalidateOnFocus: false }
  );

  // Reset selection when switching markets
  const switchMarket = (m: Market) => {
    if (m === market) return;
    setEngineOn(false);
    setMarket(m);
    setInstrument(DEFAULTS[m]);
    setTimeframe(m === "crypto" ? "1H" : "1mo");
    setCandles([]);
    setTradeMsg(null);
  };

  // ---- Crypto symbol search ----
  const { data: cryptoMarkets } = useSWR<CryptoMarket[]>(
    market === "crypto" ? "bybit-spot-tickers" : null,
    () => fetchSpotTickers(),
    { refreshInterval: 30000, revalidateOnFocus: false, keepPreviousData: true }
  );

  const cryptoMatches = useMemo(() => {
    const all = [...(cryptoMarkets ?? [])].sort((a, b) => b.volume - a.volume);
    const q = cryptoQuery.trim().toLowerCase();
    if (!q) return all.slice(0, 8);
    return all
      .filter((m) => m.base.toLowerCase().includes(q) || m.symbol.toLowerCase().includes(q))
      .slice(0, 8);
  }, [cryptoMarkets, cryptoQuery]);

  // ---- Load historical candles when instrument/timeframe changes ----
  const loadCandles = useCallback(async () => {
    setChartLoading(true);
    setChartError(null);
    try {
      if (market === "crypto") {
        const kl = await fetchKlines(instrument.symbol, timeframe, 200);
        setCandles(
          kl.map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, t: c.t }))
        );
      } else {
        const res = await fetch(
          `/api/stock?symbol=${encodeURIComponent(instrument.symbol)}&period=${encodeURIComponent(stockPeriod)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load data.");
        const data = (json.data ?? []) as { time: string; open: number; high: number; low: number; close: number; volume: number }[];
        setCandles(
          data.map((d) => ({
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
            t: new Date(d.time).getTime(),
          }))
        );
        if (typeof json.currentPrice === "number") {
          setPrices((p) => ({ ...p, [instrument.symbol]: json.currentPrice }));
        }
      }
    } catch (err) {
      setChartError((err as Error).message);
      setCandles([]);
    } finally {
      setChartLoading(false);
    }
  }, [market, instrument.symbol, timeframe, stockPeriod]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  // ---- Poll live prices for selected symbol + all open positions ----
  const symbolsToPrice = useMemo(() => {
    const set = new Set<string>([instrument.symbol]);
    (paper?.positions ?? []).forEach((p) => set.add(p.symbol));
    return Array.from(set);
  }, [instrument.symbol, paper?.positions]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        if (market === "crypto") {
          const results = await Promise.all(
            symbolsToPrice.map((s) => fetchTicker(s).catch(() => null))
          );
          if (!active) return;
          setPrices((prev) => {
            const next = { ...prev };
            results.forEach((t, i) => {
              if (t && t.price > 0) next[symbolsToPrice[i]] = t.price;
            });
            return next;
          });
        } else {
          const res = await fetch(`/api/price?symbols=${encodeURIComponent(symbolsToPrice.join(","))}`);
          const json = await res.json();
          if (!active) return;
          if (json.prices) setPrices((prev) => ({ ...prev, ...json.prices }));
        }
      } catch {
        /* transient — keep last prices */
      }
    };
    poll();
    const id = setInterval(poll, market === "crypto" ? 4000 : 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [market, symbolsToPrice]);

  // ---- Live chart: nudge the last candle toward the live price ----
  useEffect(() => {
    if (livePrice <= 0) return;
    setCandles((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      const last = { ...next[next.length - 1] };
      last.close = livePrice;
      last.high = Math.max(last.high, livePrice);
      last.low = Math.min(last.low, livePrice);
      next[next.length - 1] = last;
      return next;
    });
  }, [livePrice]);

  // ---- Derived account figures ----
  const positionForSymbol = useMemo(
    () => paper?.positions.find((p) => p.symbol === instrument.symbol) ?? null,
    [paper?.positions, instrument.symbol]
  );

  const { holdingsValue, equity, totalPnl } = useMemo(() => {
    let hv = 0;
    (paper?.positions ?? []).forEach((p) => {
      const mark = prices[p.symbol] ?? p.avgEntry;
      hv += p.qty * mark;
    });
    const cash = paper?.cashBalance ?? 0;
    const eq = cash + hv;
    const start = paper?.startingBalance ?? 100000;
    return { holdingsValue: hv, equity: eq, totalPnl: eq - start };
  }, [paper, prices]);

  // ---- Trade execution ----
  const runTrade = useCallback(
    async (side: "BUY" | "SELL", qty: number, source: "manual" | "strategy", note?: string) => {
      if (!Number.isFinite(qty) || qty <= 0) {
        setTradeMsg({ kind: "err", text: "Enter a valid quantity." });
        return false;
      }
      const price = prices[instrument.symbol] ?? 0;
      if (price <= 0) {
        setTradeMsg({ kind: "err", text: "Waiting for a live price quote…" });
        return false;
      }
      const res = await executeTrade({
        market,
        symbol: instrument.symbol,
        name: instrument.name,
        side,
        qty,
        price,
        source,
        strategy: source === "strategy" ? strategy : null,
      });
      if (res.ok && res.state) {
        mutate(res.state, { revalidate: false });
        const label = `${side} ${qty} ${instrument.symbol} @ ${fmtPrice(price)}`;
        setTradeMsg({ kind: "ok", text: note ? `${note}: ${label}` : label });
        return true;
      }
      setTradeMsg({ kind: "err", text: res.error || "Trade failed." });
      return false;
    },
    [market, instrument, prices, strategy, mutate]
  );

  const handleManual = async (side: "BUY" | "SELL") => {
    setBusy(true);
    await runTrade(side, parseFloat(qtyInput), "manual");
    setBusy(false);
  };

  const sellAll = async () => {
    if (!positionForSymbol) return;
    setBusy(true);
    await runTrade("SELL", positionForSymbol.qty, "manual");
    setBusy(false);
  };

  // ---- Strategy auto-engine ----
  const pushLog = (msg: string) =>
    setEngineLog((prev) => [`${new Date().toLocaleTimeString("en-US", { hour12: false })} ${msg}`, ...prev].slice(0, 30));

  useEffect(() => {
    if (!engineOn) return;
    pushLog(`Engine started · ${strategyLabels[strategy]} on ${instrument.symbol}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineOn]);

  // Engine tick: react to new live prices.
  useEffect(() => {
    if (!engineOn || candles.length < 5 || livePrice <= 0) return;
    if (engineBusyRef.current) return;

    const p = params[strategy];
    const closes = candles.map((c) => c.close);
    const pos = paper?.positions.find((x) => x.symbol === instrument.symbol) ?? null;
    const cash = paper?.cashBalance ?? 0;

    const tick = async () => {
      engineBusyRef.current = true;
      try {
        // Risk management on open position (stop loss / take profit)
        if (pos && pos.qty > 0) {
          const change = (livePrice - pos.avgEntry) / pos.avgEntry;
          const sl = (p.stopLoss ?? 0) / 100;
          const tp = (p.takeProfit ?? 0) / 100;
          if (sl > 0 && change <= -sl) {
            await runTrade("SELL", pos.qty, "strategy", "Stop loss");
            pushLog(`Stop loss hit (${(change * 100).toFixed(2)}%) — closed ${instrument.symbol}`);
            return;
          }
          if (tp > 0 && change >= tp) {
            await runTrade("SELL", pos.qty, "strategy", "Take profit");
            pushLog(`Take profit hit (+${(change * 100).toFixed(2)}%) — closed ${instrument.symbol}`);
            return;
          }
        }

        const stance = evaluateStance(closes, strategy, p);
        if (stance === "LONG" && (!pos || pos.qty <= 0)) {
          const budget = cash * (allocation / 100);
          const qty = market === "crypto" ? +(budget / livePrice).toFixed(6) : Math.floor(budget / livePrice);
          if (qty > 0) {
            const ok = await runTrade("BUY", qty, "strategy", `${strategyLabels[strategy]} entry`);
            if (ok) pushLog(`${strategyLabels[strategy]} → LONG — opened ${qty} ${instrument.symbol}`);
          } else {
            pushLog(`LONG signal but insufficient cash for an entry.`);
          }
        } else if (stance === "FLAT" && pos && pos.qty > 0) {
          const ok = await runTrade("SELL", pos.qty, "strategy", `${strategyLabels[strategy]} exit`);
          if (ok) pushLog(`${strategyLabels[strategy]} → FLAT — closed ${instrument.symbol}`);
        }
      } finally {
        engineBusyRef.current = false;
      }
    };
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePrice, engineOn]);

  const handleReset = async () => {
    setBusy(true);
    setEngineOn(false);
    const state = await resetPaperAccount(market);
    mutate(state, { revalidate: false });
    setEngineLog([]);
    setTradeMsg({ kind: "ok", text: "Account reset to $100,000." });
    setBusy(false);
  };

  const selectCrypto = (m: CryptoMarket) => {
    setEngineOn(false);
    setInstrument({ symbol: m.symbol, name: m.name });
    setCryptoQuery("");
  };

  const selectStock = (symbol: string) => {
    setEngineOn(false);
    setStockQuery(symbol);
    setInstrument({ symbol: symbol.toUpperCase(), name: symbol.toUpperCase() });
  };

  const updateParam = (key: keyof StrategyParams, value: number) =>
    setParams((prev) => ({ ...prev, [strategy]: { ...prev[strategy], [key]: value } }));

  const curParams = params[strategy];
  const pnlUp = totalPnl >= 0;

  // Snapshot the current paper session into the EOD review payload. Captured at
  // click time so the AI review reflects the latest equity, positions & trades.
  const buildEodPayload = useCallback<() => EodPayload>(() => {
    const trades = paper?.trades ?? [];
    const sells = trades.filter((t) => t.side === "SELL");
    const strategies = Array.from(
      new Set(
        trades
          .filter((t) => t.source === "strategy" && t.strategy)
          .map((t) => strategyLabels[t.strategy as StrategyId] ?? (t.strategy as string))
      )
    );
    return {
      market,
      equity,
      cash: paper?.cashBalance ?? 0,
      holdingsValue,
      startingBalance: paper?.startingBalance ?? 100000,
      totalPnl,
      positions: (paper?.positions ?? []).map((p) => {
        const mark = prices[p.symbol] ?? p.avgEntry;
        return {
          symbol: p.symbol,
          qty: p.qty,
          avgEntry: p.avgEntry,
          mark,
          unrealizedPnl: (mark - p.avgEntry) * p.qty,
        };
      }),
      tradeStats: {
        total: trades.length,
        buys: trades.filter((t) => t.side === "BUY").length,
        sells: sells.length,
        realizedPnl: sells.reduce((a, t) => a + t.realizedPnl, 0),
        wins: sells.filter((t) => t.realizedPnl > 0).length,
        losses: sells.filter((t) => t.realizedPnl < 0).length,
        autoTrades: trades.filter((t) => t.source === "strategy").length,
        strategies,
      },
    };
  }, [paper, prices, market, equity, holdingsValue, totalPnl]);

  return (
    <>
      <Navbar />
      <div className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>Paper Trading</h1>
            <span className={styles.liveBadge}>
              <span className={styles.livePulse} />
              Live
            </span>
          </div>
          <div className={styles.marketToggle} role="tablist" aria-label="Market">
            <button
              role="tab"
              aria-selected={market === "crypto"}
              className={`${styles.marketBtn} ${market === "crypto" ? styles.marketBtnActive : ""}`}
              onClick={() => switchMarket("crypto")}
            >
              Crypto
            </button>
            <button
              role="tab"
              aria-selected={market === "stock"}
              className={`${styles.marketBtn} ${market === "stock" ? styles.marketBtnActive : ""}`}
              onClick={() => switchMarket("stock")}
            >
              Stocks
            </button>
          </div>
        </header>

        {/* Account summary */}
        <div className={styles.summaryBar}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Equity</span>
            <span className={styles.summaryValue}>{fmtUsd(equity)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Cash</span>
            <span className={styles.summaryValue}>{fmtUsd(paper?.cashBalance ?? 0)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Holdings</span>
            <span className={styles.summaryValue}>{fmtUsd(holdingsValue)}</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total P&L</span>
            <span className={`${styles.summaryValue} ${pnlUp ? styles.profit : styles.loss}`}>
              {pnlUp ? "+" : ""}{fmtUsd(totalPnl)}
            </span>
          </div>
        </div>

        <div className={styles.body}>
          {/* Chart column */}
          <div className={styles.chartCol}>
            <div className={styles.chartPanel}>
              <div className={styles.chartHeader}>
                <div className={styles.chartPair}>
                  <span className={styles.chartSymbol}>{instrument.symbol}</span>
                  <span className={styles.chartPrice}>{fmtPrice(livePrice)}</span>
                  <span className={styles.chartName}>{instrument.name}</span>
                </div>
                <div className={styles.timeframes}>
                  {market === "crypto"
                    ? cryptoTimeframes.map((tf) => (
                        <button
                          key={tf}
                          className={`${styles.tfBtn} ${tf === timeframe ? styles.tfBtnActive : ""}`}
                          onClick={() => setTimeframe(tf)}
                        >
                          {tf}
                        </button>
                      ))
                    : stockPeriods.map((p) => (
                        <button
                          key={p.value}
                          className={`${styles.tfBtn} ${p.value === stockPeriod ? styles.tfBtnActive : ""}`}
                          onClick={() => setStockPeriod(p.value)}
                        >
                          {p.label}
                        </button>
                      ))}
                </div>
              </div>
              <div className={styles.chartBody}>
                {chartLoading ? (
                  <div className={styles.chartStatus}>
                    <div className={styles.spinner} />
                    <span>Loading {instrument.symbol}…</span>
                  </div>
                ) : chartError ? (
                  <div className={styles.chartStatus}>
                    <span className={styles.errText}>{chartError}</span>
                  </div>
                ) : candles.length > 0 ? (
                  <SimulatedChart
                    timeframe={market === "crypto" ? timeframe : "1D"}
                    staticCandles={candles}
                    strategy={strategy}
                    showAlgo={engineOn}
                    params={curParams as unknown as Record<string, number>}
                    ariaLabel={`${instrument.symbol} candlestick chart`}
                  />
                ) : (
                  <div className={styles.chartStatus}>
                    <span>No data.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Positions */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>Open Positions</span>
                {paper && paper.positions.length > 0 && (
                  <span className="badge badge-accent">{paper.positions.length}</span>
                )}
              </div>
              {paper && paper.positions.length > 0 ? (
                <div className={styles.posTable}>
                  <div className={`${styles.posRow} ${styles.posHeadRow}`}>
                    <span>Symbol</span>
                    <span>Qty</span>
                    <span>Avg</span>
                    <span>Mark</span>
                    <span>Unreal. P&L</span>
                  </div>
                  {paper.positions.map((p) => {
                    const mark = prices[p.symbol] ?? p.avgEntry;
                    const pnl = (mark - p.avgEntry) * p.qty;
                    const up = pnl >= 0;
                    return (
                      <button
                        key={p.symbol}
                        className={styles.posRow}
                        onClick={() =>
                          market === "crypto"
                            ? setInstrument({ symbol: p.symbol, name: p.name })
                            : selectStock(p.symbol)
                        }
                        title={`View ${p.symbol}`}
                      >
                        <span className={styles.posSym}>{p.symbol}</span>
                        <span className="mono">{p.qty}</span>
                        <span className="mono">{fmtPrice(p.avgEntry)}</span>
                        <span className="mono">{fmtPrice(mark)}</span>
                        <span className={`mono ${up ? styles.profit : styles.loss}`}>
                          {up ? "+" : ""}{fmtUsd(pnl)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.empty}>No open positions. Place a trade to get started.</p>
              )}
            </div>

            {/* Trade history */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={styles.panelTitle}>Trade History</span>
              </div>
              {paper && paper.trades.length > 0 ? (
                <div className={styles.historyList}>
                  {paper.trades.map((t) => (
                    <div key={t.id} className={styles.histRow}>
                      <div className={styles.histLeft}>
                        <span
                          className={styles.histSide}
                          style={{ color: t.side === "BUY" ? "var(--color-profit)" : "var(--color-loss)" }}
                        >
                          {t.side}
                        </span>
                        <span className={styles.histSym}>{t.symbol}</span>
                        {t.source === "strategy" && <span className={styles.histTag}>auto</span>}
                      </div>
                      <div className={styles.histMid}>
                        <span className="mono">{t.qty} @ {fmtPrice(t.price)}</span>
                        <span className={styles.histTime}>{timeAgo(t.createdAt)}</span>
                      </div>
                      <span
                        className={`mono ${styles.histPnl}`}
                        style={{
                          color: t.side === "SELL"
                            ? t.realizedPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {t.side === "SELL" ? `${t.realizedPnl >= 0 ? "+" : ""}${fmtUsd(t.realizedPnl)}` : fmtUsd(t.total)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.empty}>No trades yet.</p>
              )}
            </div>

            {/* AI end-of-day review */}
            <EodReview
              marketLabel={market === "crypto" ? "Crypto" : "Stocks"}
              buildPayload={buildEodPayload}
            />
          </div>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            {/* Instrument picker */}
            <div className={styles.card}>
              <span className={styles.cardLabel}>Instrument</span>
              {market === "crypto" ? (
                <>
                  <div className={styles.searchWrap}>
                    <input
                      className={styles.searchInput}
                      placeholder="Search coins (BTC, SOL…)"
                      value={cryptoQuery}
                      onChange={(e) => setCryptoQuery(e.target.value)}
                    />
                  </div>
                  <div className={styles.symList}>
                    {cryptoMatches.map((m) => (
                      <button
                        key={m.symbol}
                        className={`${styles.symBtn} ${m.symbol === instrument.symbol ? styles.symBtnActive : ""}`}
                        onClick={() => selectCrypto(m)}
                      >
                        <span className={styles.symName}>{m.base}</span>
                        <span className={`mono ${styles.symPrice}`}>{fmtPrice(m.price)}</span>
                        <span className={`${styles.symChg} ${m.change >= 0 ? styles.profit : styles.loss}`}>
                          {m.change >= 0 ? "+" : ""}{m.change}%
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <TickerSearch
                  value={stockQuery}
                  onChange={setStockQuery}
                  onSelect={selectStock}
                  disabled={busy}
                />
              )}
            </div>

            {/* Trading method switch — manual OR algorithm, not both */}
            <div className={styles.modeSwitch} role="tablist" aria-label="Trading method">
              <button
                role="tab"
                aria-selected={tradeMode === "manual"}
                className={`${styles.modeBtn} ${tradeMode === "manual" ? styles.modeBtnActive : ""}`}
                onClick={() => { setEngineOn(false); setTradeMode("manual"); }}
              >
                Manual
              </button>
              <button
                role="tab"
                aria-selected={tradeMode === "algo"}
                className={`${styles.modeBtn} ${tradeMode === "algo" ? styles.modeBtnActive : ""}`}
                onClick={() => setTradeMode("algo")}
              >
                Algorithm
              </button>
            </div>

            {/* Manual trade */}
            {tradeMode === "manual" && (
            <div className={styles.card}>
              <span className={styles.cardLabel}>Manual Order · {instrument.symbol}</span>
              {positionForSymbol && (
                <p className={styles.holdingNote}>
                  Holding <strong>{positionForSymbol.qty}</strong> @ {fmtPrice(positionForSymbol.avgEntry)}
                </p>
              )}
              <input
                className={styles.qtyInput}
                type="number"
                min="0"
                step="any"
                placeholder="Quantity"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
              />
              <div className={styles.estRow}>
                <span>Est. cost</span>
                <span className="mono">
                  {qtyInput && livePrice > 0 ? fmtUsd(parseFloat(qtyInput) * livePrice) : "—"}
                </span>
              </div>
              <div className={styles.tradeBtns}>
                <button
                  className={`${styles.buyBtn}`}
                  onClick={() => handleManual("BUY")}
                  disabled={busy}
                >
                  Buy
                </button>
                <button
                  className={`${styles.sellBtn}`}
                  onClick={() => handleManual("SELL")}
                  disabled={busy}
                >
                  Sell
                </button>
              </div>
              {positionForSymbol && (
                <button className={styles.closeBtn} onClick={sellAll} disabled={busy}>
                  Close position ({positionForSymbol.qty})
                </button>
              )}
              {tradeMsg && (
                <p className={tradeMsg.kind === "ok" ? styles.msgOk : styles.msgErr}>{tradeMsg.text}</p>
              )}
            </div>
            )}

            {/* Strategy engine */}
            {tradeMode === "algo" && (
            <div className={styles.card}>
              <div className={styles.engineHead}>
                <span className={styles.cardLabel}>Strategy Engine</span>
                <button
                  className={`${styles.engineToggle} ${engineOn ? styles.engineOn : ""}`}
                  onClick={() => setEngineOn((v) => !v)}
                  aria-pressed={engineOn}
                >
                  <span className={styles.engineKnob} />
                </button>
              </div>

              <select
                className={styles.select}
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as StrategyId)}
                disabled={engineOn}
              >
                {Object.entries(strategyLabels).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>

              {/* Strategy-specific indicator inputs */}
              {strategyParamControls[strategy].map((ctrl) => {
                const raw = (curParams as Record<string, number | undefined>)[ctrl.key];
                const value = raw ?? ctrl.min;
                const display = ctrl.step < 1 ? value.toFixed(1) : Math.round(value);
                return (
                  <div key={ctrl.key as string}>
                    <div className={styles.paramRow}>
                      <label>{ctrl.label}</label>
                      <span className="mono">{display}{ctrl.suffix ?? ""}</span>
                    </div>
                    <input
                      type="range"
                      min={ctrl.min}
                      max={ctrl.max}
                      step={ctrl.step}
                      className="slider"
                      value={value}
                      onChange={(e) => updateParam(ctrl.key, +e.target.value)}
                      disabled={engineOn}
                    />
                  </div>
                );
              })}

              <div className={styles.paramRow}>
                <label>Allocation per entry</label>
                <span className="mono">{allocation}%</span>
              </div>
              <input
                type="range" min="5" max="100" step="5" className="slider"
                value={allocation}
                onChange={(e) => setAllocation(+e.target.value)}
                disabled={engineOn}
              />

              <div className={styles.paramRow}>
                <label>Stop loss</label>
                <span className="mono" style={{ color: "var(--color-loss)" }}>{curParams.stopLoss}%</span>
              </div>
              <input
                type="range" min="1" max="20" step="0.5" className="slider"
                value={curParams.stopLoss}
                onChange={(e) => updateParam("stopLoss", +e.target.value)}
                disabled={engineOn}
              />

              <div className={styles.paramRow}>
                <label>Take profit</label>
                <span className="mono" style={{ color: "var(--color-profit)" }}>{curParams.takeProfit}%</span>
              </div>
              <input
                type="range" min="1" max="40" step="0.5" className="slider"
                value={curParams.takeProfit}
                onChange={(e) => updateParam("takeProfit", +e.target.value)}
                disabled={engineOn}
              />

              <p className={styles.engineHint}>
                {engineOn
                  ? `Engine is live — ${strategyLabels[strategy]} is evaluating ${instrument.symbol} on every price update and will open or close positions automatically.`
                  : "Tune the indicator inputs above, then turn on to auto-trade the selected strategy with live prices. Controls lock while the engine runs."}
              </p>

              {engineLog.length > 0 && (
                <div className={styles.engineLog}>
                  {engineLog.map((l, i) => (
                    <div key={i} className={styles.logLine}>{l}</div>
                  ))}
                </div>
              )}
            </div>
            )}

            <button className={styles.resetBtn} onClick={handleReset} disabled={busy}>
              Reset {market === "crypto" ? "Crypto" : "Stock"} Account
            </button>
          </aside>
        </div>
      </div>
    </>
  );
}
