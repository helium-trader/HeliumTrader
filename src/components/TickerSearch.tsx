"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./TickerSearch.module.css";

interface TickerMatch {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  price: number | null;
  currency: string;
  changePercent: number | null;
  logo: string;
}

interface TickerSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when a result is picked (or Enter pressed). Loads that ticker. */
  onSelect: (symbol: string) => void;
  disabled?: boolean;
}

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return "—";
  const symbol = currency === "USD" ? "$" : "";
  return `${symbol}${price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${currency !== "USD" ? ` ${currency}` : ""}`;
}

function Logo({ src, symbol }: { src: string; symbol: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={styles.logoFallback} aria-hidden="true">
        {symbol.charAt(0)}
      </span>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src || "/placeholder.svg"}
      alt=""
      className={styles.logo}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

export default function TickerSearch({ value, onChange, onSelect, disabled }: TickerSearchProps) {
  const [results, setResults] = useState<TickerMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextSearch = useRef(false);

  // Debounced search whenever the query changes.
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        setResults(json.results ?? []);
        setOpen(true);
        setHighlight(-1);
      } catch {
        /* aborted or failed — ignore */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [value]);

  // Close dropdown on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function pick(symbol: string) {
    skipNextSearch.current = true;
    onChange(symbol);
    setOpen(false);
    setResults([]);
    onSelect(symbol);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === "Enter") onSelect(value);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && highlight < results.length) {
        pick(results[highlight].symbol);
      } else {
        onSelect(value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <input
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search ticker or company…"
        autoCapitalize="characters"
        spellCheck={false}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls="ticker-listbox"
        aria-autocomplete="list"
      />
      {loading && <span className={styles.inputSpinner} aria-hidden="true" />}

      {open && results.length > 0 && (
        <ul className={styles.dropdown} id="ticker-listbox" role="listbox">
          {results.map((r, i) => {
            const up = (r.changePercent ?? 0) >= 0;
            return (
              <li
                key={r.symbol}
                role="option"
                aria-selected={i === highlight}
                className={`${styles.option} ${i === highlight ? styles.optionActive : ""}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r.symbol);
                }}
              >
                <Logo src={r.logo} symbol={r.symbol} />
                <span className={styles.info}>
                  <span className={styles.symbol}>{r.symbol}</span>
                  <span className={styles.name}>{r.name}</span>
                </span>
                <span className={styles.priceCol}>
                  <span className={styles.price}>{formatPrice(r.price, r.currency)}</span>
                  {r.changePercent != null && (
                    <span className={`${styles.change} ${up ? styles.changeUp : styles.changeDown}`}>
                      {up ? "+" : ""}
                      {r.changePercent.toFixed(2)}%
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
