import { NextResponse } from "next/server";

export const revalidate = 60;

const CG = "https://api.coingecko.com/api/v3";

interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
}

interface CryptoResult {
  id: string;
  symbol: string; // base asset, e.g. "BTC"
  name: string; // e.g. "Bitcoin"
  image: string;
  tvSymbol: string; // TradingView symbol, e.g. "BINANCE:BTCUSDT"
  price: number;
  change: number; // 24h percent change
}

// Simple in-memory cache (per server instance) to stay well under
// CoinGecko's free public rate limits and survive transient 429s.
const CACHE_TTL = 60_000; // 60s fresh window
const cache = new Map<string, { ts: number; data: CryptoResult[] }>();

function mapMarkets(list: CoinMarket[]): CryptoResult[] {
  return list
    .filter((c) => Number.isFinite(c.current_price))
    .map((c) => {
      const sym = c.symbol.toUpperCase();
      const change = c.price_change_percentage_24h ?? 0;
      return {
        id: c.id,
        symbol: sym,
        name: c.name,
        image: c.image,
        tvSymbol: `BINANCE:${sym}USDT`,
        price: c.current_price,
        change: parseFloat(change.toFixed(2)),
      };
    });
}

// Fetch with one retry + small backoff when rate-limited (429) or 5xx.
async function fetchWithRetry(url: string, attempts = 2): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 60 },
        headers: { accept: "application/json" },
      });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        lastErr = new Error(`status ${res.status}`);
        continue;
      }
      return res; // non-retryable
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim().toLowerCase();
  const cacheKey = query || "__top__";

  // Serve fresh cache immediately.
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ results: cached.data });
  }

  try {
    let ids: string | null = null;

    if (query) {
      const searchRes = await fetchWithRetry(
        `${CG}/search?query=${encodeURIComponent(query)}`
      );
      if (!searchRes.ok) throw new Error(`search ${searchRes.status}`);
      const searchJson = await searchRes.json();
      const coins: Array<{ id: string }> = searchJson?.coins ?? [];
      if (coins.length === 0) {
        cache.set(cacheKey, { ts: Date.now(), data: [] });
        return NextResponse.json({ results: [] });
      }
      ids = coins.slice(0, 25).map((c) => c.id).join(",");
    }

    const marketsUrl = ids
      ? `${CG}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&order=market_cap_desc&per_page=25&page=1`
      : `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`;

    const res = await fetchWithRetry(marketsUrl);
    if (!res.ok) throw new Error(`markets ${res.status}`);

    const list: CoinMarket[] = await res.json();
    const data = mapMarkets(list);
    cache.set(cacheKey, { ts: Date.now(), data });
    return NextResponse.json({ results: data });
  } catch (err) {
    console.log("[v0] CoinGecko crypto fetch failed:", (err as Error).message);
    // Fall back to stale cache if we have any — better than an empty list.
    if (cached) {
      return NextResponse.json({ results: cached.data, stale: true });
    }
    // No cache yet: signal an error so the client (SWR) retries with backoff.
    return NextResponse.json({ results: [], error: "rate_limited" }, { status: 503 });
  }
}
