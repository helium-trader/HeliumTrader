"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { fetchSpotTickers, type CryptoMarket } from "@/lib/bybit";
import styles from "./CryptoTab.module.css";

export type CryptoResult = CryptoMarket;

interface CryptoTabProps {
  activeSymbol: string;
  onSelect: (coin: CryptoResult) => void;
}

const WATCHLIST_KEY = "helium_watchlist_bybit";

const defaultWatchlist: CryptoResult[] = [
  { symbol: "BTCUSDT", base: "BTC", quote: "USDT", name: "BTC / USDT", tvSymbol: "BYBIT:BTCUSDT", price: 0, change: 0, volume: 0 },
  { symbol: "ETHUSDT", base: "ETH", quote: "USDT", name: "ETH / USDT", tvSymbol: "BYBIT:ETHUSDT", price: 0, change: 0, volume: 0 },
  { symbol: "SOLUSDT", base: "SOL", quote: "USDT", name: "SOL / USDT", tvSymbol: "BYBIT:SOLUSDT", price: 0, change: 0, volume: 0 },
];

function formatPrice(p: number) {
  if (p === 0) return "—";
  if (p < 1) return `$${p.toFixed(4)}`;
  if (p < 1000) return `$${p.toFixed(2)}`;
  return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function CryptoTab({ activeSymbol, onSelect }: CryptoTabProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [watchlist, setWatchlist] = useState<CryptoResult[]>(defaultWatchlist);
  const [hydrated, setHydrated] = useState(false);

  // Load watchlist from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      if (raw) setWatchlist(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persist watchlist
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {
      /* ignore */
    }
  }, [watchlist, hydrated]);

  // Debounce the search query (state only — SWR does the fetching)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 450);
    return () => clearTimeout(t);
  }, [query]);

  // Load all Bybit spot markets directly from the browser (Bybit is geo-blocked
  // server-side), refreshing every 20s. Search/sort happens locally.
  const { data, isLoading, error } = useSWR<CryptoResult[]>(
    "bybit-spot-tickers",
    () => fetchSpotTickers(),
    {
      refreshInterval: 20000,
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      keepPreviousData: true,
      errorRetryCount: 4,
      errorRetryInterval: 1500,
    }
  );

  const results = useMemo(() => {
    const all = [...(data ?? [])].sort((a, b) => b.volume - a.volume);
    const q = debounced.toLowerCase();
    if (!q) return all.slice(0, 50);
    return all
      .filter(
        (m) =>
          m.base.toLowerCase().includes(q) ||
          m.symbol.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [data, debounced]);
  const watchSymbols = useMemo(
    () => new Set(watchlist.map((w) => w.tvSymbol)),
    [watchlist]
  );

  // Merge live prices into the saved watchlist for display.
  const watchlistLive = useMemo(() => {
    const bySymbol = new Map((data ?? []).map((m) => [m.symbol, m]));
    return watchlist.map((w) => bySymbol.get(w.symbol) ?? w);
  }, [watchlist, data]);

  const toggleWatch = (coin: CryptoResult) => {
    setWatchlist((prev) =>
      prev.some((w) => w.tvSymbol === coin.tvSymbol)
        ? prev.filter((w) => w.tvSymbol !== coin.tvSymbol)
        : [...prev, coin]
    );
  };

  const renderRow = (coin: CryptoResult, inWatchlist: boolean) => {
    const isActive = coin.symbol === activeSymbol || coin.tvSymbol === activeSymbol;
    return (
      <div
        key={coin.symbol}
        className={`${styles.row} ${isActive ? styles.rowActive : ""}`}
      >
        <button
          className={styles.rowMain}
          onClick={() => onSelect(coin)}
          title={`Load ${coin.base} in chart`}
        >
          <span className={styles.coinImgFallback}>{coin.base.charAt(0)}</span>
          <span className={styles.rowLeft}>
            <span className={styles.symbol}>{coin.base}</span>
            <span className={styles.name}>{coin.name}</span>
          </span>
          <span className={styles.rowRight}>
            <span className={styles.price}>{formatPrice(coin.price)}</span>
            {coin.price > 0 && (
              <span className={`${styles.change} ${coin.change >= 0 ? "profit" : "loss"}`}>
                {coin.change >= 0 ? "+" : ""}{coin.change}%
              </span>
            )}
          </span>
        </button>
        <button
          className={`${styles.watchBtn} ${inWatchlist ? styles.watchBtnActive : ""}`}
          onClick={() => toggleWatch(coin)}
          aria-label={inWatchlist ? `Remove ${coin.symbol} from watchlist` : `Add ${coin.symbol} to watchlist`}
          title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
        >
          {inWatchlist ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>
    );
  };

  // Search results excluding ones already in the watchlist (shown separately)
  const searchResults = results.filter((r) => !watchSymbols.has(r.tvSymbol));

  return (
    <div className={styles.container}>
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <input
          className={styles.searchInput}
          placeholder="Search coins (e.g. BTC, Solana)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => setQuery("")} aria-label="Clear search">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Watchlist · {watchlist.length}</span>
          <div className={styles.list}>
            {watchlistLive.map((coin) => renderRow(coin, true))}
          </div>
        </div>
      )}

      {/* Search / Top markets */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>
          {debounced ? "Search results" : "Top markets"}
        </span>
        {isLoading ? (
          <div className={styles.list}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonRow} skeleton`} />
            ))}
          </div>
        ) : searchResults.length > 0 ? (
          <div className={styles.list}>
            {searchResults.map((coin) => renderRow(coin, watchSymbols.has(coin.tvSymbol)))}
          </div>
        ) : error ? (
          <p className={styles.empty}>Live prices are busy. Retrying…</p>
        ) : (
          <p className={styles.empty}>
            {debounced ? `No coins found for "${debounced}"` : "No market data available"}
          </p>
        )}
      </div>
    </div>
  );
}
