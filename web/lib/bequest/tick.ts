// Dead-man's switch — fires expired bequests. Invoked by Vercel Cron every minute.
//
// Idempotency: we set status='triggered' + triggered_at BEFORE broadcasting,
// in a single conditional UPDATE. Two cron invocations cannot double-fire.
// On broadcast failure we set status='failed' so it doesn't retry forever.

import { and, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { decrypt } from "../crypto";
import { sendOnchain } from "../zerion/send";
import { type ScopedPolicy } from "../zerion/policy";
import { explorerTxUrl } from "./explorer";
import { sendTelegram, sendTriggeredEmail } from "../notify";
import type { Address, Hex } from "viem";

export type TickResult = {
  scanned: number;
  fired: number;
  errors: Array<{ bequestId: string; error: string }>;
  delivered: Array<{ bequestId: string; txnHash: string }>;
};

export async function tick(): Promise<TickResult> {
  const now = new Date();
  const result: TickResult = { scanned: 0, fired: 0, errors: [], delivered: [] };

  // Find all bequests where now > last_ping_at + checkin_window_seconds
  const expired = await db
    .select()
    .from(schema.bequests)
    .where(
      and(
        eq(schema.bequests.status, "armed"),
        // last_ping_at + checkin_window_seconds * interval '1 second' < now
        sql`${schema.bequests.lastPingAt} + (${schema.bequests.checkinWindowSeconds} || ' seconds')::interval < ${now}`,
      ),
    );

  result.scanned = expired.length;

  for (const b of expired) {
    // Atomic guard: flip to triggered ONLY if still armed
    const updated = await db
      .update(schema.bequests)
      .set({ status: "triggered", triggeredAt: now })
      .where(and(eq(schema.bequests.id, b.id), eq(schema.bequests.status, "armed")))
      .returning({ id: schema.bequests.id });
    if (updated.length === 0) continue; // someone else fired/cancelled

    try {
      const policy: ScopedPolicy = b.policyJson ? JSON.parse(b.policyJson) : null;
      if (!policy) throw new Error("Bequest is armed but has no policy");

      const pk = decrypt(b.walletKeyCiphertext, b.walletKeyNonce, `wallet:${b.id}`) as Hex;
      const send = await sendOnchain({
        chain: b.assetChain,
        asset: b.assetSymbol,
        amount: b.amountDecimal,
        to: b.beneficiaryAddress as Address,
        privateKey: pk,
        policy, // ← scoped policy gate runs HERE, before signing
      });

      await db
        .update(schema.bequests)
        .set({ txnHash: send.hash })
        .where(eq(schema.bequests.id, b.id));

      result.fired += 1;
      result.delivered.push({ bequestId: b.id, txnHash: send.hash });

      // Notify owner
      void notifyOwner(b.id, send.hash);
    } catch (err) {
      const msg = (err as Error).message ?? "unknown";
      await db
        .update(schema.bequests)
        .set({ status: "failed", failureReason: msg })
        .where(eq(schema.bequests.id, b.id));
      result.errors.push({ bequestId: b.id, error: msg });
    }
  }

  return result;
}

async function notifyOwner(bequestId: string, txnHash: string) {
  try {
    const rows = await db
      .select({
        bq: schema.bequests,
        user: schema.users,
      })
      .from(schema.bequests)
      .innerJoin(schema.users, eq(schema.users.id, schema.bequests.userId))
      .where(eq(schema.bequests.id, bequestId))
      .limit(1);
    if (!rows[0]) return;
    const { bq, user } = rows[0];
    const url = explorerTxUrl(bq.assetChain, txnHash);
    await sendTriggeredEmail({
      to: user.email,
      bequestId: bq.id,
      txnHash,
      chainExplorerUrl: url,
      beneficiary: bq.beneficiaryAddress,
      asset: bq.assetSymbol,
      amount: bq.amountDecimal,
    });
    if (user.telegramChatId) {
      await sendTelegram(
        user.telegramChatId,
        `Bequest ${bq.id} delivered.\n${bq.amountDecimal} ${bq.assetSymbol} → ${bq.beneficiaryAddress.slice(0, 8)}…\n${url}`,
      );
    }
  } catch {
    // Notifications are best-effort; don't fail the trigger on a notify error.
  }
}
