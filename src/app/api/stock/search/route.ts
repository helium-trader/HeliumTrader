import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export const revalidate = 60;

export interface TickerMatch {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  price: number | null;
  currency: string;
  changePercent: number | null;
  logo: string;
}

// Build a logo URL for a ticker. The client falls back to a letter badge if it 404s.
function logoFor(symbol: string): string {
  return `https://assets.parqet.com/logos/symbol/${encodeURIComponent(symbol)}?format=png&size=64`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const search = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });

    // Keep tradable equities and ETFs that live on Yahoo Finance.
    const candidates = (search?.quotes ?? [])
      .filter(
        (q): q is typeof q & { symbol: string } =>
          "isYahooFinance" in q &&
          q.isYahooFinance === true &&
          "symbol" in q &&
          typeof q.symbol === "string" &&
          "quoteType" in q &&
          (q.quoteType === "EQUITY" || q.quoteType === "ETF")
      )
      .slice(0, 6);

    if (candidates.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const symbols = candidates.map((q) => q.symbol);

    // Fetch live quotes for prices in a single request.
    let quoteMap = new Map<string, { price: number | null; currency: string; changePercent: number | null }>();
    try {
      const quotes = await yahooFinance.quote(symbols);
      const list = Array.isArray(quotes) ? quotes : [quotes];
      quoteMap = new Map(
        list.map((q) => [
          q.symbol,
          {
            price: q.regularMarketPrice ?? null,
            currency: q.currency ?? "USD",
            changePercent: q.regularMarketChangePercent ?? null,
          },
        ])
      );
    } catch (err) {
      console.log("[v0] quote lookup failed:", (err as Error).message);
    }

    const results: TickerMatch[] = candidates.map((q) => {
      const quote = quoteMap.get(q.symbol);
      const name =
        ("longname" in q && q.longname) ||
        ("shortname" in q && q.shortname) ||
        q.symbol;
      return {
        symbol: q.symbol,
        name: name as string,
        exchange: ("exchDisp" in q && (q.exchDisp as string)) || "",
        type: ("typeDisp" in q && (q.typeDisp as string)) || "",
        price: quote?.price ?? null,
        currency: quote?.currency ?? "USD",
        changePercent: quote?.changePercent ?? null,
        logo: logoFor(q.symbol),
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.log("[v0] ticker search failed:", (err as Error).message);
    return NextResponse.json({ results: [] });
  }
}
