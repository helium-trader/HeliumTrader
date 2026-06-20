"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import styles from "./portfolio.module.css";

// --- Types ---
interface Position {
  symbol: string;
  name: string;
  qty: number;
  avgEntry: number;
  currentPrice: number;
  allocation: number;
}

interface HistoryTrade {
  id: number;
  symbol: string;
  type: "BUY" | "SELL";
  qty: number;
  price: number;
  total: number;
  pnl: number;
  date: string;
}

// --- Static demo data ---
const positions: Position[] = [
  { symbol: "SUI",  name: "Sui",       qty: 820,    avgEntry: 3.21,   currentPrice: 3.847,  allocation: 34 },
  { symbol: "BTC",  name: "Bitcoin",   qty: 0.042,  avgEntry: 61200,  currentPrice: 67420,  allocation: 30 },
  { symbol: "ETH",  name: "Ethereum",  qty: 0.78,   avgEntry: 3100,   currentPrice: 3521.8, allocation: 20 },
  { symbol: "SOL",  name: "Solana",    qty: 4.5,    avgEntry: 155,    currentPrice: 178.4,  allocation: 10 },
  { symbol: "DOGE", name: "Dogecoin",  qty: 2400,   avgEntry: 0.148,  currentPrice: 0.1612, allocation: 6  },
];

const historyTrades: HistoryTrade[] = [
  { id: 1, symbol: "SUI",  type: "BUY",  qty: 200, price: 3.15,   total: 630,    pnl:  0,     date: "Jun 18, 2025" },
  { id: 2, symbol: "ETH",  type: "SELL", qty: 0.2, price: 3640,   total: 728,    pnl:  54.2,  date: "Jun 17, 2025" },
  { id: 3, symbol: "BTC",  type: "BUY",  qty: 0.01,price: 62100,  total: 621,    pnl:  0,     date: "Jun 16, 2025" },
  { id: 4, symbol: "SOL",  type: "SELL", qty: 2,   price: 182,    total: 364,    pnl:  14,    date: "Jun 15, 2025" },
  { id: 5, symbol: "DOGE", type: "BUY",  qty: 1000,price: 0.144,  total: 144,    pnl:  0,     date: "Jun 14, 2025" },
  { id: 6, symbol: "SUI",  type: "SELL", qty: 150, price: 3.72,   total: 558,    pnl:  76.5,  date: "Jun 13, 2025" },
  { id: 7, symbol: "ETH",  type: "BUY",  qty: 0.3, price: 3050,   total: 915,    pnl:  0,     date: "Jun 12, 2025" },
  { id: 8, symbol: "BTC",  type: "SELL", qty: 0.008,price: 65800, total: 526.4,  pnl:  37.6,  date: "Jun 11, 2025" },
];

function generateEquityCurve(days: number) {
  let val = 9200;
  return Array.from({ length: days }, (_, i) => {
    const trend = Math.sin(i / 8) * 0.003 + 0.0018;
    val = val * (1 + trend + (Math.random() - 0.46) * 0.009);
    return Math.max(val, 8000);
  });
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<"positions" | "history">("positions");

  const equityCurve = useMemo(() => generateEquityCurve(60), []);
  const totalValue = positions.reduce(
    (acc, p) => acc + p.qty * p.currentPrice,
    0
  );
  const totalCost = positions.reduce(
    (acc, p) => acc + p.qty * p.avgEntry,
    0
  );
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = ((totalPnl / totalCost) * 100).toFixed(2);
  const isProfit = totalPnl >= 0;

  // SVG equity curve
  const eqMin = Math.min(...equityCurve);
  const eqMax = Math.max(...equityCurve);
  const eqRange = eqMax - eqMin || 1;
  const W = 1000;
  const H = 160;
  const pts = equityCurve.map((v, i) => {
    const x = (i / (equityCurve.length - 1)) * W;
    const y = H - ((v - eqMin) / eqRange) * (H - 8) - 4;
    return `${x},${y}`;
  });
  const linePath = "M" + pts.join(" L");
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;

  const realized = historyTrades.reduce((a, t) => a + (t.type === "SELL" ? t.pnl : 0), 0);
  const unrealized = totalPnl;

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <div className={styles.inner}>

          {/* Page header */}
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Portfolio</h1>
              <p className={styles.pageSubtitle}>Simulated paper trading account</p>
            </div>
            <div className={styles.headerBadge}>Paper Account</div>
          </div>

          {/* Top stats */}
          <div className={styles.statsRow}>
            <div className={styles.mainStat}>
              <span className={styles.mainStatLabel}>Total Value</span>
              <span className={styles.mainStatValue}>
                ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`${styles.mainStatChange} ${isProfit ? styles.profit : styles.loss}`}>
                {isProfit ? "+" : ""}${Math.abs(totalPnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({isProfit ? "+" : ""}{totalPnlPct}%) all time
              </span>
            </div>
            <div className={styles.subStats}>
              <div className={styles.subStat}>
                <span className={styles.subStatLabel}>Unrealized P&L</span>
                <span className={`${styles.subStatValue} ${unrealized >= 0 ? styles.profit : styles.loss}`}>
                  {unrealized >= 0 ? "+" : ""}${Math.abs(unrealized).toFixed(2)}
                </span>
              </div>
              <div className={styles.subStat}>
                <span className={styles.subStatLabel}>Realized P&L</span>
                <span className={`${styles.subStatValue} ${realized >= 0 ? styles.profit : styles.loss}`}>
                  {realized >= 0 ? "+" : ""}${realized.toFixed(2)}
                </span>
              </div>
              <div className={styles.subStat}>
                <span className={styles.subStatLabel}>Open Positions</span>
                <span className={styles.subStatValue}>{positions.length}</span>
              </div>
              <div className={styles.subStat}>
                <span className={styles.subStatLabel}>Trades Closed</span>
                <span className={styles.subStatValue}>{historyTrades.filter(t => t.type === "SELL").length}</span>
              </div>
            </div>
          </div>

          {/* Equity Curve */}
          <div className={styles.equityCard}>
            <div className={styles.equityCardHeader}>
              <span className={styles.equityCardTitle}>Equity Curve</span>
              <span className={styles.equityCardPeriod}>Last 60 days</span>
            </div>
            <div className={styles.equityCardBody}>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className={styles.equitySvg}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="portfolio-eq-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isProfit ? "#22c55e" : "#ef4444"} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={isProfit ? "#22c55e" : "#ef4444"} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#portfolio-eq-grad)" />
                <path d={linePath} fill="none" stroke={isProfit ? "#22c55e" : "#ef4444"} strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Allocation bar */}
          <div className={styles.allocationCard}>
            <span className={styles.sectionLabel}>Allocation</span>
            <div className={styles.allocationBar}>
              {positions.map((p) => (
                <div
                  key={p.symbol}
                  className={styles.allocationSegment}
                  style={{ width: `${p.allocation}%` }}
                  title={`${p.symbol} ${p.allocation}%`}
                />
              ))}
            </div>
            <div className={styles.allocationLegend}>
              {positions.map((p) => (
                <div key={p.symbol} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: symbolColor(p.symbol) }} />
                  <span className={styles.legendSymbol}>{p.symbol}</span>
                  <span className={styles.legendPct}>{p.allocation}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs: Positions / History */}
          <div className={styles.tabBar}>
            <button
              className={`${styles.tabBtn} ${tab === "positions" ? styles.tabBtnActive : ""}`}
              onClick={() => setTab("positions")}
            >
              Positions
            </button>
            <button
              className={`${styles.tabBtn} ${tab === "history" ? styles.tabBtnActive : ""}`}
              onClick={() => setTab("history")}
            >
              Trade History
            </button>
          </div>

          {tab === "positions" && (
            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th className={styles.right}>Qty</th>
                    <th className={styles.right}>Avg Entry</th>
                    <th className={styles.right}>Current Price</th>
                    <th className={styles.right}>Value</th>
                    <th className={styles.right}>Unrealized P&L</th>
                    <th className={styles.right}>Alloc.</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const value = p.qty * p.currentPrice;
                    const pnl = (p.currentPrice - p.avgEntry) * p.qty;
                    const pnlPct = ((p.currentPrice - p.avgEntry) / p.avgEntry) * 100;
                    const up = pnl >= 0;
                    return (
                      <tr key={p.symbol}>
                        <td>
                          <div className={styles.assetCell}>
                            <span
                              className={styles.assetIcon}
                              style={{ background: symbolColor(p.symbol) }}
                              aria-hidden="true"
                            >
                              {p.symbol[0]}
                            </span>
                            <div>
                              <div className={styles.assetSymbol}>{p.symbol}</div>
                              <div className={styles.assetName}>{p.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className={styles.right}>
                          <span className={styles.mono}>{p.qty < 1 ? p.qty.toFixed(4) : p.qty.toLocaleString()}</span>
                        </td>
                        <td className={styles.right}>
                          <span className={styles.mono}>${p.avgEntry < 1 ? p.avgEntry.toFixed(4) : p.avgEntry.toLocaleString()}</span>
                        </td>
                        <td className={styles.right}>
                          <span className={styles.mono}>${p.currentPrice < 1 ? p.currentPrice.toFixed(4) : p.currentPrice.toLocaleString()}</span>
                        </td>
                        <td className={styles.right}>
                          <span className={styles.mono}>${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </td>
                        <td className={styles.right}>
                          <div className={styles.pnlCell}>
                            <span className={`${styles.mono} ${up ? styles.profit : styles.loss}`}>
                              {up ? "+" : ""}${Math.abs(pnl).toFixed(2)}
                            </span>
                            <span className={`${styles.pnlPct} ${up ? styles.profit : styles.loss}`}>
                              {up ? "+" : ""}{pnlPct.toFixed(2)}%
                            </span>
                          </div>
                        </td>
                        <td className={styles.right}>
                          <div className={styles.allocCell}>
                            <span className={styles.mono}>{p.allocation}%</span>
                            <div className={styles.allocMini}>
                              <div
                                className={styles.allocMiniFill}
                                style={{ width: `${p.allocation}%`, background: symbolColor(p.symbol) }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === "history" && (
            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th className={styles.right}>Qty</th>
                    <th className={styles.right}>Price</th>
                    <th className={styles.right}>Total</th>
                    <th className={styles.right}>Realized P&L</th>
                    <th className={styles.right}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyTrades.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className={styles.assetCell}>
                          <span
                            className={styles.assetIcon}
                            style={{ background: symbolColor(t.symbol) }}
                            aria-hidden="true"
                          >
                            {t.symbol[0]}
                          </span>
                          <span className={styles.assetSymbol}>{t.symbol}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={styles.typeBadge}
                          style={{
                            color: t.type === "BUY" ? "var(--color-profit)" : "var(--color-loss)",
                            background: t.type === "BUY" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                            border: `1px solid ${t.type === "BUY" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                          }}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className={styles.right}><span className={styles.mono}>{t.qty < 1 ? t.qty.toFixed(4) : t.qty}</span></td>
                      <td className={styles.right}><span className={styles.mono}>${t.price.toLocaleString()}</span></td>
                      <td className={styles.right}><span className={styles.mono}>${t.total.toFixed(2)}</span></td>
                      <td className={styles.right}>
                        {t.type === "SELL" ? (
                          <span className={`${styles.mono} ${t.pnl >= 0 ? styles.profit : styles.loss}`}>
                            {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                          </span>
                        ) : (
                          <span className={styles.mono} style={{ color: "var(--text-tertiary)" }}>—</span>
                        )}
                      </td>
                      <td className={styles.right}><span className={styles.dateCell}>{t.date}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>
    </>
  );
}

// Deterministic per-symbol color
function symbolColor(symbol: string) {
  const map: Record<string, string> = {
    BTC:  "#f7931a",
    ETH:  "#627eea",
    SUI:  "#4da2ff",
    SOL:  "#9945ff",
    BNB:  "#f3ba2f",
    DOGE: "#c2a633",
    AVAX: "#e84142",
    ARB:  "#28a0f0",
  };
  return map[symbol] ?? "#888";
}
