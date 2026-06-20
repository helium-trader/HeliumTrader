import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { report } from "@/lib/db/schema";
import type { BacktestMetrics } from "@/lib/backtest";

const MODEL = "openai/gpt-5-mini";

interface Body {
  symbol?: string;
  name?: string;
  period?: string;
  strategy?: string;
  strategyLabel?: string;
  metrics?: BacktestMetrics;
  tradeCount?: number;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id ?? null;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const { symbol, name, period, strategyLabel, metrics, tradeCount } = body;
  if (!symbol || !metrics) {
    return new Response("Missing backtest data", { status: 400 });
  }

  const pf = metrics.profitFactor === -1 ? "infinite (no losing trades)" : metrics.profitFactor.toFixed(2);

  const factsBlock = [
    `Symbol: ${symbol}${name ? ` (${name})` : ""}`,
    `Strategy: ${strategyLabel ?? body.strategy}`,
    `Backtest period: ${period}`,
    `Total trades: ${metrics.totalTrades}`,
    `Win rate: ${metrics.winRate}%`,
    `Total return: ${metrics.totalReturn}%`,
    `Max drawdown: ${metrics.maxDrawdown}%`,
    `Profit factor: ${pf}`,
    `Sharpe (per-trade proxy): ${metrics.sharpe}`,
    `Avg win: ${metrics.avgWin}% | Avg loss: ${metrics.avgLoss}%`,
    `Best trade: ${metrics.bestTrade}% | Worst trade: ${metrics.worstTrade}%`,
    `Winning trades: ${metrics.winningTrades} | Losing trades: ${metrics.losingTrades}`,
    `Avg hold: ${metrics.avgHoldBars} bars`,
  ].join("\n");

  const result = streamText({
    model: MODEL,
    system:
      "You are a quantitative trading analyst writing a concise backtest report. " +
      "Use ONLY the metrics provided — never invent numbers. Write in clear markdown with these sections: " +
      "**Summary** (2-3 sentences), **Strengths**, **Risks & Weaknesses**, and **Suggested Adjustments** " +
      "(reference concrete strategy parameters like periods, stop-loss, take-profit). " +
      "Be direct and practical. Note when a small trade count makes results statistically weak. " +
      "Keep the whole report under 320 words.",
    prompt: `Analyze this strategy backtest and produce the report:\n\n${factsBlock}`,
    onFinish: async ({ text }) => {
      if (!userId || !text.trim()) return;
      try {
        const firstPara = text.trim().split("\n\n")[0]?.replace(/[#*]/g, "").slice(0, 300) ?? null;
        await db.insert(report).values({
          userId,
          kind: "backtest",
          title: `${strategyLabel ?? body.strategy} backtest — ${symbol} (${period})`,
          symbol,
          strategy: body.strategy ?? null,
          summary: firstPara,
          content: text,
          metrics: { ...metrics, period, tradeCount },
        });
      } catch (err) {
        console.log("[v0] Failed to save backtest report:", (err as Error).message);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
