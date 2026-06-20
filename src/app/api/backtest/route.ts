import { NextResponse } from "next/server";
import { fetchCandles, StockFetchError } from "@/lib/stock";
import { runBacktest } from "@/lib/backtest";
import type { StrategyId, StrategyParams } from "@/lib/strategy";

const VALID_STRATEGIES: StrategyId[] = ["sma_crossover", "rsi", "bollinger", "macd"];

export async function POST(request: Request) {
  let body: {
    symbol?: string;
    period?: string;
    strategy?: string;
    params?: StrategyParams;
    startingEquity?: number;
    switchEnabled?: boolean;
    switchThreshold?: number;
    switchStrategy?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const strategy = (body.strategy || "sma_crossover") as StrategyId;
  if (!VALID_STRATEGIES.includes(strategy)) {
    return NextResponse.json({ error: "Unknown strategy" }, { status: 400 });
  }

  try {
    const result = await fetchCandles(body.symbol || "", body.period || "6mo");
    const backtest = runBacktest(result.data, strategy, body.params ?? {}, {
      startingEquity: body.startingEquity ?? 100000,
      stopLoss: body.params?.stopLoss,
      takeProfit: body.params?.takeProfit,
      switchEnabled: body.switchEnabled,
      switchThreshold: body.switchThreshold,
      switchStrategy: body.switchStrategy as StrategyId | undefined,
    });

    return NextResponse.json({
      symbol: result.symbol,
      name: result.name,
      currency: result.currency,
      period: result.period,
      currentPrice: result.currentPrice,
      candles: result.data,
      strategy,
      ...backtest,
    });
  } catch (err) {
    if (err instanceof StockFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.log("[v0] Backtest failed:", (err as Error).message);
    return NextResponse.json({ error: "Backtest failed. Please try again." }, { status: 500 });
  }
}
