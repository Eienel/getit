import {
  pgTable,
  text,
  integer,
  bigint,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  telegramChatId: text("telegram_chat_id"),
  ownerAddress: text("owner_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per bequest. The `wallet_*` columns hold the per-bequest hot wallet's
// encrypted private key, and `agent_token_*` the encrypted scoped agent token
// associated with that wallet's policy. Both are encrypted with envelope AES-GCM
// using a master key from the Vercel env. See lib/crypto.ts.
export const bequests = pgTable(
  "bequests",
  {
    id: text("id").primaryKey(), // "bq_<8>"
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"), // optional, for display ("To Sarah, my sister")

    beneficiaryAddress: text("beneficiary_address").notNull(),
    assetSymbol: text("asset_symbol").notNull(), // "USDC", "ETH"
    assetChain: text("asset_chain").notNull(), // "base"
    amountDecimal: text("amount_decimal").notNull(), // string for precision

    checkinWindowSeconds: integer("checkin_window_seconds").notNull(),

    // Per-bequest hot wallet (the funds custody address)
    walletAddress: text("wallet_address").notNull().unique(),
    walletKeyCiphertext: text("wallet_key_ciphertext").notNull(),
    walletKeyNonce: text("wallet_key_nonce").notNull(),

    // Scoped agent token + policy (Zerion-style)
    policyJson: text("policy_json"), // JSON string of the policy object
    agentTokenCiphertext: text("agent_token_ciphertext"),
    agentTokenNonce: text("agent_token_nonce"),

    status: text("status").notNull().default("draft"), // draft | armed | triggered | cancelled | failed

    lastPingAt: timestamp("last_ping_at", { withTimezone: true }),
    armedAt: timestamp("armed_at", { withTimezone: true }),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

    txnHash: text("txn_hash"),
    failureReason: text("failure_reason"),
  },
  (t) => ({
    userIdx: index("bequest_user_idx").on(t.userId),
    statusIdx: index("bequest_status_idx").on(t.status),
  }),
);

export const pingLogs = pgTable(
  "ping_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bequestId: text("bequest_id")
      .notNull()
      .references(() => bequests.id, { onDelete: "cascade" }),
    source: text("source").notNull(), // web | telegram | email
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byBequest: index("ping_log_bequest_idx").on(t.bequestId),
  }),
);

// Idempotency table for nudges — one row per (bequestId, kind, ping_cycle_at).
// `ping_cycle_at` is the bequest's `last_ping_at` when the nudge was sent;
// when the user pings, the cycle changes, so nudges can fire again next cycle.
export const nudges = pgTable(
  "nudges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bequestId: text("bequest_id")
      .notNull()
      .references(() => bequests.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 50pct | 75pct | 90pct
    pingCycleAt: timestamp("ping_cycle_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byBequestKindCycle: index("nudge_dedupe_idx").on(t.bequestId, t.kind, t.pingCycleAt),
  }),
);

// Magic-link sessions — single-use signin tokens
export const magicLinks = pgTable("magic_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Telegram /start tokens — one-time, link a chat_id to a user.
export const telegramLinks = pgTable("telegram_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});
