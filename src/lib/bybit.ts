// Bybit v5 public market data helpers.
// Docs: https://bybit-exchange.github.io/docs/v5/market/tickers
// All endpoints used here are public (no API key required).
//
// NOTE: Bybit's REST API is geo-blocked from many server regions (incl. US
// Vercel) via CloudFront. These helpers are therefore called directly from the
// browser so requests originate from the end user's own location.

export const BYBIT_BASE = "https://api.bybit.com";

export interface BybitTicker {
  symbol: string; // e.g. "BTCUSDT"
  lastPrice: string;
  price24hPcnt: string; // fraction, e.g. "0.0123" = +1.23%
  volume24h: string;
  turnover24h: string;
  highPrice24h: string;
  lowPrice24h: string;
}

export interface CryptoMarket {
  symbol: string; // Bybit symbol, e.g. "BTCUSDT"
  base: string; // base asset, e.g. "BTC"
  quote: string; // quote asset, e.g. "USDT"
  name: string; // display name, e.g. "BTC / USDT"
  tvSymbol: string; // TradingView symbol, e.g. "BYBIT:BTCUSDT"
  price: number;
  change: number; // 24h percent change
  volume: number; // 24h turnover in quote currency
}

export interface BybitKline {
  t: number; // open time (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Map a Bybit spot interval label to the v5 `interval` query value.
// v5 intervals: 1 3 5 15 30 60 120 240 360 720 D W M (minutes / D=day...)
export const INTERVAL_MAP: Record<string, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1H": "60",
  "4H": "240",
  "1D": "D",
  "1W": "W",
};

async function bybitFetch(
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${BYBIT_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bybit ${path} ${res.status}`);
  const json = (await res.json()) as { retCode: number; retMsg: string; result?: unknown };
  if (json.retCode !== 0) throw new Error(`Bybit ${path}: ${json.retMsg}`);
  return json.result;
}

function deriveBase(symbol: string): { base: string; quote: string } {
  // Spot pairs end with a known quote asset. USDT covers the vast majority.
  const quotes = ["USDT", "USDC", "USD", "BTC", "ETH", "DAI", "EUR"];
  for (const q of quotes) {
    if (symbol.endsWith(q) && symbol.length > q.length) {
      return { base: symbol.slice(0, -q.length), quote: q };
    }
  }
  return { base: symbol, quote: "" };
}

export function mapTicker(t: BybitTicker): CryptoMarket {
  const { base, quote } = deriveBase(t.symbol);
  const price = parseFloat(t.lastPrice);
  const change = parseFloat(t.price24hPcnt) * 100;
  return {
    symbol: t.symbol,
    base,
    quote,
    name: `${base} / ${quote}`,
    tvSymbol: `BYBIT:${t.symbol}`,
    price: Number.isFinite(price) ? price : 0,
    change: Number.isFinite(change) ? parseFloat(change.toFixed(2)) : 0,
    volume: parseFloat(t.turnover24h) || 0,
  };
}

// Fetch all spot tickers (single request, no key).
export async function fetchSpotTickers(): Promise<CryptoMarket[]> {
  const result = (await bybitFetch("/v5/market/tickers", {
    category: "spot",
  })) as { list?: BybitTicker[] };
  const list = result?.list ?? [];
  return list
    .map(mapTicker)
    .filter((m) => m.quote === "USDT" && m.price > 0);
}

// Fetch a single ticker (live, uncached) — used by the price endpoint/engine.
export async function fetchTicker(symbol: string): Promise<CryptoMarket | null> {
  const result = (await bybitFetch("/v5/market/tickers", {
    category: "spot",
    symbol,
  })) as { list?: BybitTicker[] };
  const t = result?.list?.[0];
  return t ? mapTicker(t) : null;
}

// Fetch historical candles for a symbol.
export async function fetchKlines(
  symbol: string,
  interval: string,
  limit = 200
): Promise<BybitKline[]> {
  const result = (await bybitFetch("/v5/market/kline", {
    category: "spot",
    symbol,
    interval: INTERVAL_MAP[interval] ?? "60",
    limit: String(Math.min(Math.max(limit, 1), 1000)),
  })) as { list?: string[][] };
  const list = result?.list ?? [];
  // Bybit returns newest-first: [startTime, open, high, low, close, volume, turnover]
  return list
    .map((row) => ({
      t: Number(row[0]),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }))
    .filter((c) => Number.isFinite(c.close))
    .sort((a, b) => a.t - b.t); // oldest-first for the chart
}
