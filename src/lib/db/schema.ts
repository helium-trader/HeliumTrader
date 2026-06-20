import {
  pgTable,
  text,
  timestamp,
  boolean,
  doublePrecision,
  serial,
  jsonb,
} from "drizzle-orm/pg-core";

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// --- Paper trading app tables ----------------------------------------------
// Per-user scoping via a plain `userId` column (no FK by design).
// `market` distinguishes the two paper accounts: "stock" and "crypto".

export const paperAccount = pgTable("paper_account", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  market: text("market").notNull(), // "stock" | "crypto"
  cashBalance: doublePrecision("cashBalance").notNull().default(100000),
  startingBalance: doublePrecision("startingBalance").notNull().default(100000),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const position = pgTable("position", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  market: text("market").notNull(), // "stock" | "crypto"
  symbol: text("symbol").notNull(), // e.g. "AAPL" or "BTCUSDT"
  name: text("name").notNull().default(""),
  qty: doublePrecision("qty").notNull().default(0),
  avgEntry: doublePrecision("avgEntry").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const trade = pgTable("trade", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  market: text("market").notNull(), // "stock" | "crypto"
  symbol: text("symbol").notNull(),
  name: text("name").notNull().default(""),
  side: text("side").notNull(), // "BUY" | "SELL"
  qty: doublePrecision("qty").notNull(),
  price: doublePrecision("price").notNull(),
  total: doublePrecision("total").notNull(),
  realizedPnl: doublePrecision("realizedPnl").notNull().default(0),
  source: text("source").notNull().default("manual"), // "manual" | "strategy"
  strategy: text("strategy"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

// --- AI-generated reports --------------------------------------------------
// Persists both backtest analyses (kind="backtest") and end-of-day paper
// trading reviews (kind="eod"). Per-user scoping via plain `userId`.

export const report = pgTable("report", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  kind: text("kind").notNull(), // "backtest" | "eod"
  title: text("title").notNull(),
  symbol: text("symbol"),
  strategy: text("strategy"),
  summary: text("summary"),
  content: text("content").notNull(),
  metrics: jsonb("metrics"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
