import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { report } from "@/lib/db/schema";
import { formatAiStreamError } from "@/lib/ai-error";
import { reportModel } from "@/lib/ai-model";

interface PositionFact {
  symbol: string;
  qty: number;
  avgEntry: number;
  mark: number;
  unrealizedPnl: number;
}

interface Body {
  market?: "stock" | "crypto";
  equity?: number;
  cash?: number;
  holdingsValue?: number;
  startingBalance?: number;
  totalPnl?: number;
  positions?: PositionFact[];
  tradeStats?: {
    total: number;
    buys: number;
    sells: number;
    realizedPnl: number;
    wins: number;
    losses: number;
    autoTrades: number;
    strategies: string[];
  };
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id ?? null;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const {
    market = "crypto",
    equity = 0,
    cash = 0,
    holdingsValue = 0,
    startingBalance = 100000,
    totalPnl = 0,
    positions = [],
    tradeStats,
  } = body;

  if (!tradeStats) {
    return new Response("Missing trading data", { status: 400 });
  }

  const marketLabel = market === "crypto" ? "Crypto" : "Stocks";
  const returnPct = startingBalance ? (totalPnl / startingBalance) * 100 : 0;
  const closed = tradeStats.wins + tradeStats.losses;
  const winRate = closed ? (tradeStats.wins / closed) * 100 : 0;

  const positionsBlock = positions.length
    ? positions
        .map(
          (p) =>
            `  - ${p.symbol}: ${p.qty} @ avg ${usd(p.avgEntry)}, mark ${usd(p.mark)}, unrealized ${
              p.unrealizedPnl >= 0 ? "+" : ""
            }${usd(p.unrealizedPnl)}`
        )
        .join("\n")
    : "  - None (flat / all cash)";

  const factsBlock = [
    `Market: ${marketLabel} paper account`,
    `Starting balance: ${usd(startingBalance)}`,
    `Current equity: ${usd(equity)} (cash ${usd(cash)} + holdings ${usd(holdingsValue)})`,
    `Total P&L: ${totalPnl >= 0 ? "+" : ""}${usd(totalPnl)} (${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%)`,
    `Trades executed: ${tradeStats.total} (${tradeStats.buys} buys, ${tradeStats.sells} sells)`,
    `Auto-executed (strategy) trades: ${tradeStats.autoTrades}`,
    `Strategies used: ${tradeStats.strategies.length ? tradeStats.strategies.join(", ") : "manual only"}`,
    `Closed trades: ${closed} (${tradeStats.wins} winners, ${tradeStats.losses} losers, win rate ${winRate.toFixed(1)}%)`,
    `Realized P&L from closed trades: ${tradeStats.realizedPnl >= 0 ? "+" : ""}${usd(tradeStats.realizedPnl)}`,
    `Open positions:`,
    positionsBlock,
  ].join("\n");

  const result = streamText({
    model: reportModel,
    system:
      "You are a trading coach writing a concise end-of-day review of a trader's paper account. " +
      "Use ONLY the data provided — never invent numbers or trades. Write in clear markdown with these sections: " +
      "**Summary** (2-3 sentences on the day's outcome), **What Worked**, **What To Watch** (risks, " +
      "concentration, open exposure), and **Tomorrow's Plan** (specific, actionable). " +
      "Be encouraging but honest. If there were no trades, say so plainly and suggest a starting focus. " +
      "Note when a small number of closed trades makes conclusions tentative. Keep it under 300 words.",
    prompt: `Write the end-of-day review from this paper trading session:\n\n${factsBlock}`,
    onFinish: async ({ text }) => {
      if (!userId || !text.trim()) return;
      try {
        const firstPara = text.trim().split("\n\n")[0]?.replace(/[#*]/g, "").slice(0, 300) ?? null;
        const dateLabel = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        await db.insert(report).values({
          userId,
          kind: "eod",
          title: `${marketLabel} EOD review — ${dateLabel}`,
          symbol: null,
          strategy: tradeStats.strategies[0] ?? null,
          summary: firstPara,
          content: text,
          metrics: {
            market,
            equity,
            totalPnl,
            returnPct: Number(returnPct.toFixed(2)),
            trades: tradeStats.total,
            winRate: Number(winRate.toFixed(1)),
            realizedPnl: tradeStats.realizedPnl,
          },
        });
      } catch (err) {
        console.log("[v0] Failed to save EOD report:", (err as Error).message);
      }
    },
  });

  return result.toUIMessageStreamResponse({
    onError: formatAiStreamError,
  });
}
