import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

// OHLCV candle.
export interface Candle {
  time: string; // ISO date "2026-06-20" (daily/weekly) or full ISO timestamp (intraday)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleResult {
  symbol: string;
  name: string;
  currentPrice: number;
  currency: string;
  period: Period;
  data: Candle[];
}

export type Period = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";

export const ALLOWED_PERIODS: Period[] = ["1mo", "3mo", "6mo", "1y", "2y", "5y"];

export function normalizePeriod(value: string | null | undefined): Period {
  const p = (value || "6mo").trim() as Period;
  return ALLOWED_PERIODS.includes(p) ? p : "6mo";
}

// Choose a candle interval that keeps the dataset reasonable for each range.
// Short ranges use an hourly interval so there are enough candles for
// strategy indicators to warm up and produce completed trades — a daily
// interval over 1 month is only ~21 candles, too few for most indicators.
function intervalFor(period: Period): "1h" | "1d" | "1wk" {
  if (period === "1mo" || period === "3mo") return "1h";
  return period === "2y" || period === "5y" ? "1wk" : "1d";
}

// Intraday intervals need the full timestamp so candles on the same day stay
// distinct; daily/weekly intervals only need the date.
function isIntraday(interval: string): boolean {
  return interval.endsWith("h") || interval.endsWith("m");
}

function startDateFor(period: Period): Date {
  const d = new Date();
  switch (period) {
    case "1mo":
      d.setMonth(d.getMonth() - 1);
      break;
    case "3mo":
      d.setMonth(d.getMonth() - 3);
      break;
    case "6mo":
      d.setMonth(d.getMonth() - 6);
      break;
    case "1y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    case "2y":
      d.setFullYear(d.getFullYear() - 2);
      break;
    case "5y":
      d.setFullYear(d.getFullYear() - 5);
      break;
  }
  return d;
}

export class StockFetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Fetch historical OHLCV candles for a symbol. Throws StockFetchError with an
// appropriate HTTP status on failure so callers can map it to a response.
export async function fetchCandles(symbolRaw: string, periodRaw: string): Promise<CandleResult> {
  const symbol = (symbolRaw || "").trim().toUpperCase();
  const period = normalizePeriod(periodRaw);
  if (!symbol) throw new StockFetchError("Missing symbol", 400);

  const interval = intervalFor(period);
  const intraday = isIntraday(interval);

  let result;
  try {
    result = await yahooFinance.chart(symbol, { period1: startDateFor(period), interval });
  } catch (err) {
    const message = (err as Error).message || "Failed to fetch stock data";
    console.log("[v0] Yahoo Finance stock fetch failed:", message);
    if (/not found|404|No data/i.test(message)) {
      throw new StockFetchError(`Could not find ticker "${symbol}"`, 404);
    }
    throw new StockFetchError("Failed to fetch stock data. Please try again.", 502);
  }

  const quotes = result?.quotes ?? [];
  const data: Candle[] = quotes
    .filter((q) => q.date != null && q.open != null && q.high != null && q.low != null && q.close != null)
    .map((q) => ({
      time: intraday
        ? new Date(q.date as Date).toISOString()
        : new Date(q.date as Date).toISOString().slice(0, 10),
      open: Number((q.open as number).toFixed(2)),
      high: Number((q.high as number).toFixed(2)),
      low: Number((q.low as number).toFixed(2)),
      close: Number((q.close as number).toFixed(2)),
      volume: q.volume ?? 0,
    }));

  if (data.length === 0) {
    throw new StockFetchError(`No data found for "${symbol}"`, 404);
  }

  const meta = result?.meta;
  const name = meta?.longName || meta?.shortName || symbol;
  const currentPrice = meta?.regularMarketPrice ?? data[data.length - 1].close;
  const currency = meta?.currency ?? "USD";

  return {
    symbol,
    name,
    currentPrice: Number(currentPrice.toFixed(2)),
    currency,
    period,
    data,
  };
}
