import { NextResponse } from "next/server";
import { fetchCandles, StockFetchError } from "@/lib/stock";

export const revalidate = 300;

// Re-exported for existing client imports.
export type { Candle as StockData } from "@/lib/stock";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || "";
  const period = searchParams.get("period") || "6mo";

  try {
    const result = await fetchCandles(symbol, period);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StockFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Failed to fetch stock data. Please try again." },
      { status: 502 }
    );
  }
}
