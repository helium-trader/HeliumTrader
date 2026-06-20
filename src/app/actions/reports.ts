"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { report } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

export type ReportKind = "backtest" | "eod";

export interface SavedReport {
  id: number;
  kind: ReportKind;
  title: string;
  symbol: string | null;
  strategy: string | null;
  summary: string | null;
  content: string;
  metrics: Record<string, unknown> | null;
  createdAt: string;
}

async function getUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

// Persist a generated report scoped to the current user. Returns null when the
// caller is not authenticated (the report simply isn't saved).
export async function saveReport(input: {
  kind: ReportKind;
  title: string;
  symbol?: string | null;
  strategy?: string | null;
  summary?: string | null;
  content: string;
  metrics?: Record<string, unknown> | null;
}): Promise<{ id: number } | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const [row] = await db
    .insert(report)
    .values({
      userId,
      kind: input.kind,
      title: input.title,
      symbol: input.symbol ?? null,
      strategy: input.strategy ?? null,
      summary: input.summary ?? null,
      content: input.content,
      metrics: input.metrics ?? null,
    })
    .returning({ id: report.id });

  return row ? { id: row.id } : null;
}

// List the current user's reports, newest first. Optionally filter by kind.
export async function getReports(kind?: ReportKind): Promise<SavedReport[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const where = kind
    ? and(eq(report.userId, userId), eq(report.kind, kind))
    : eq(report.userId, userId);

  const rows = await db
    .select()
    .from(report)
    .where(where)
    .orderBy(desc(report.createdAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as ReportKind,
    title: r.title,
    symbol: r.symbol,
    strategy: r.strategy,
    summary: r.summary,
    content: r.content,
    metrics: (r.metrics as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function deleteReport(id: number): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  await db.delete(report).where(and(eq(report.id, id), eq(report.userId, userId)));
  return true;
}
