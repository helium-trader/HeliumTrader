import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const revalidate = 300;

// OHLCV candle returned to the client.
export interface StockData {
  time: string; // ISO date, e.g. "2026-06-20"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type Period = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y";

const ALLOWED_PERIODS: Period[] = ["1mo", "3mo", "6mo", "1y", "2y", "5y"];

// Choose a candle interval that keeps the dataset reasonable for each range.
function intervalFor(period: Period): "1d" | "1wk" {
  return period === "2y" || period === "5y" ? "1wk" : "1d";
}

function startDateFor(period: Period): Date {
  const now = new Date();
  const d = new Date(now);
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || "").trim().toUpperCase();
  const periodParam = (searchParams.get("period") || "6mo").trim() as Period;
  const period: Period = ALLOWED_PERIODS.includes(periodParam) ? periodParam : "6mo";

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  try {
    const interval = intervalFor(period);
    const period1 = startDateFor(period);

    const result = await yahooFinance.chart(symbol, {
      period1,
      interval,
    });

    const quotes = result?.quotes ?? [];
    const data: StockData[] = quotes
      .filter(
        (q) =>
          q.date != null &&
          q.open != null &&
          q.high != null &&
          q.low != null &&
          q.close != null
      )
      .map((q) => ({
        time: new Date(q.date as Date).toISOString().slice(0, 10),
        open: Number((q.open as number).toFixed(2)),
        high: Number((q.high as number).toFixed(2)),
        low: Number((q.low as number).toFixed(2)),
        close: Number((q.close as number).toFixed(2)),
        volume: q.volume ?? 0,
      }));

    if (data.length === 0) {
      return NextResponse.json(
        { error: `No data found for "${symbol}"` },
        { status: 404 }
      );
    }

    const meta = result?.meta;
    const name =
      meta?.longName || meta?.shortName || symbol;
    const currentPrice =
      meta?.regularMarketPrice ?? data[data.length - 1].close;
    const currency = meta?.currency ?? "USD";

    return NextResponse.json({
      symbol,
      name,
      currentPrice: Number(currentPrice.toFixed(2)),
      currency,
      period,
      data,
    });
  } catch (err) {
    const message = (err as Error).message || "Failed to fetch stock data";
    console.log("[v0] Yahoo Finance stock fetch failed:", message);
    // Yahoo throws when a symbol can't be resolved.
    if (/not found|404|No data/i.test(message)) {
      return NextResponse.json(
        { error: `Could not find ticker "${symbol}"` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch stock data. Please try again." },
      { status: 502 }
    );
  }
}
