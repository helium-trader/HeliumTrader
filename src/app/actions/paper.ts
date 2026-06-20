"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { paperAccount, position, trade } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

export type Market = "stock" | "crypto";

const STARTING_BALANCE = 100000;

export interface PaperPosition {
  symbol: string;
  name: string;
  qty: number;
  avgEntry: number;
}

export interface PaperTrade {
  id: number;
  symbol: string;
  name: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  total: number;
  realizedPnl: number;
  source: "manual" | "strategy";
  strategy: string | null;
  createdAt: string;
}

export interface PaperState {
  market: Market;
  cashBalance: number;
  startingBalance: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
}

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function normalizeMarket(market: string): Market {
  return market === "crypto" ? "crypto" : "stock";
}

// Fetch (or lazily create) the user's account for a market.
async function ensureAccount(userId: string, market: Market) {
  const existing = await db
    .select()
    .from(paperAccount)
    .where(and(eq(paperAccount.userId, userId), eq(paperAccount.market, market)))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [created] = await db
    .insert(paperAccount)
    .values({
      userId,
      market,
      cashBalance: STARTING_BALANCE,
      startingBalance: STARTING_BALANCE,
    })
    .returning();
  return created;
}

export async function getPaperState(marketInput: string): Promise<PaperState> {
  const userId = await getUserId();
  const market = normalizeMarket(marketInput);

  const account = await ensureAccount(userId, market);

  const positions = await db
    .select()
    .from(position)
    .where(and(eq(position.userId, userId), eq(position.market, market)));

  const trades = await db
    .select()
    .from(trade)
    .where(and(eq(trade.userId, userId), eq(trade.market, market)))
    .orderBy(desc(trade.createdAt))
    .limit(100);

  return {
    market,
    cashBalance: account.cashBalance,
    startingBalance: account.startingBalance,
    positions: positions
      .filter((p) => p.qty > 1e-9)
      .map((p) => ({
        symbol: p.symbol,
        name: p.name,
        qty: p.qty,
        avgEntry: p.avgEntry,
      })),
    trades: trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      name: t.name,
      side: t.side as "BUY" | "SELL",
      qty: t.qty,
      price: t.price,
      total: t.total,
      realizedPnl: t.realizedPnl,
      source: t.source as "manual" | "strategy",
      strategy: t.strategy,
      createdAt:
        t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
    })),
  };
}

export interface ExecuteTradeInput {
  market: string;
  symbol: string;
  name?: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  source?: "manual" | "strategy";
  strategy?: string | null;
}

export interface ExecuteTradeResult {
  ok: boolean;
  error?: string;
  state?: PaperState;
}

// Execute a paper buy/sell. Price is supplied by the client (the browser is the
// only place that can read live Bybit prices), validated to be positive.
export async function executeTrade(
  input: ExecuteTradeInput
): Promise<ExecuteTradeResult> {
  const userId = await getUserId();
  const market = normalizeMarket(input.market);
  const symbol = input.symbol.trim().toUpperCase();
  const side = input.side === "SELL" ? "SELL" : "BUY";
  const qty = Number(input.qty);
  const price = Number(input.price);
  const source = input.source === "strategy" ? "strategy" : "manual";

  if (!symbol) return { ok: false, error: "Missing symbol." };
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Invalid quantity." };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Invalid price." };

  const account = await ensureAccount(userId, market);

  const existingPos = await db
    .select()
    .from(position)
    .where(
      and(
        eq(position.userId, userId),
        eq(position.market, market),
        eq(position.symbol, symbol)
      )
    )
    .limit(1);
  const pos = existingPos[0] ?? null;

  const total = qty * price;
  let realizedPnl = 0;

  if (side === "BUY") {
    if (total > account.cashBalance + 1e-6) {
      return { ok: false, error: "Insufficient buying power." };
    }
    const prevQty = pos?.qty ?? 0;
    const prevAvg = pos?.avgEntry ?? 0;
    const newQty = prevQty + qty;
    const newAvg = newQty > 0 ? (prevQty * prevAvg + qty * price) / newQty : price;

    if (pos) {
      await db
        .update(position)
        .set({ qty: newQty, avgEntry: newAvg, name: input.name ?? pos.name, updatedAt: new Date() })
        .where(eq(position.id, pos.id));
    } else {
      await db.insert(position).values({
        userId,
        market,
        symbol,
        name: input.name ?? symbol,
        qty: newQty,
        avgEntry: newAvg,
      });
    }

    await db
      .update(paperAccount)
      .set({ cashBalance: account.cashBalance - total, updatedAt: new Date() })
      .where(eq(paperAccount.id, account.id));
  } else {
    // SELL
    const heldQty = pos?.qty ?? 0;
    if (qty > heldQty + 1e-9) {
      return { ok: false, error: "Not enough quantity to sell." };
    }
    const avg = pos?.avgEntry ?? 0;
    realizedPnl = (price - avg) * qty;
    const remaining = heldQty - qty;

    if (pos) {
      if (remaining <= 1e-9) {
        await db.delete(position).where(eq(position.id, pos.id));
      } else {
        await db
          .update(position)
          .set({ qty: remaining, updatedAt: new Date() })
          .where(eq(position.id, pos.id));
      }
    }

    await db
      .update(paperAccount)
      .set({ cashBalance: account.cashBalance + total, updatedAt: new Date() })
      .where(eq(paperAccount.id, account.id));
  }

  await db.insert(trade).values({
    userId,
    market,
    symbol,
    name: input.name ?? symbol,
    side,
    qty,
    price,
    total,
    realizedPnl,
    source,
    strategy: input.strategy ?? null,
  });

  const state = await getPaperState(market);
  return { ok: true, state };
}

// Reset a market's paper account: wipe positions, trades, and restore cash.
export async function resetPaperAccount(marketInput: string): Promise<PaperState> {
  const userId = await getUserId();
  const market = normalizeMarket(marketInput);

  await db
    .delete(position)
    .where(and(eq(position.userId, userId), eq(position.market, market)));
  await db
    .delete(trade)
    .where(and(eq(trade.userId, userId), eq(trade.market, market)));

  const account = await ensureAccount(userId, market);
  await db
    .update(paperAccount)
    .set({ cashBalance: STARTING_BALANCE, startingBalance: STARTING_BALANCE, updatedAt: new Date() })
    .where(eq(paperAccount.id, account.id));

  return getPaperState(market);
}
