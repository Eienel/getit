// Sends reminder emails / Telegram messages at 50%, 75%, 90% of each
// bequest's check-in window. Idempotent via the `nudges` table, keyed on
// (bequestId, kind, ping_cycle_at) so each cycle gets exactly one of each.

import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { sendNudgeEmail, sendTelegram } from "../notify";
import { signToken } from "../crypto";

const KINDS = [
  { key: "50pct", threshold: 0.5 },
  { key: "75pct", threshold: 0.75 },
  { key: "90pct", threshold: 0.9 },
] as const;

export async function nudgeAll(): Promise<{ scanned: number; sent: number }> {
  const now = Date.now();
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const rows = await db
    .select({
      bq: schema.bequests,
      user: schema.users,
    })
    .from(schema.bequests)
    .innerJoin(schema.users, eq(schema.users.id, schema.bequests.userId))
    .where(eq(schema.bequests.status, "armed"));

  let sent = 0;
  for (const { bq, user } of rows) {
    if (!bq.lastPingAt) continue;
    const lastPing = new Date(bq.lastPingAt).getTime();
    const windowMs = bq.checkinWindowSeconds * 1000;
    const elapsed = now - lastPing;
    if (elapsed <= 0) continue;
    const elapsedFrac = elapsed / windowMs;
    if (elapsedFrac >= 1) continue; // already expired; tick handles it

    for (const k of KINDS) {
      if (elapsedFrac < k.threshold) continue;

      // Idempotency check: already sent this kind in this ping cycle?
      const existing = await db
        .select({ id: schema.nudges.id })
        .from(schema.nudges)
        .where(
          and(
            eq(schema.nudges.bequestId, bq.id),
            eq(schema.nudges.kind, k.key),
            eq(schema.nudges.pingCycleAt, bq.lastPingAt),
          ),
        )
        .limit(1);
      if (existing.length > 0) continue;

      // Mark nudge sent FIRST (idempotency anchor); if email/telegram fails,
      // we still don't double-send; user can refresh their view in-app.
      await db.insert(schema.nudges).values({
        bequestId: bq.id,
        kind: k.key,
        pingCycleAt: bq.lastPingAt,
      });

      const remainingMs = windowMs - elapsed;
      const remainingMin = Math.max(1, Math.round(remainingMs / 60_000));

      const oneTapToken = signToken({ kind: "ping", bequestId: bq.id }, 24 * 3600);
      const oneTapLink = `${appUrl.replace(/\/$/, "")}/api/bequests/${bq.id}/ping?via=email&t=${encodeURIComponent(oneTapToken)}`;

      try {
        await sendNudgeEmail({
          to: user.email,
          link: oneTapLink,
          bequestId: bq.id,
          beneficiary: bq.beneficiaryAddress,
          asset: bq.assetSymbol,
          amount: bq.amountDecimal,
          remainingMin,
          kind: k.key,
        });
        if (user.telegramChatId) {
          await sendTelegram(
            user.telegramChatId,
            `[Bequest ${bq.id}] ${k.key} of window elapsed. ${bq.amountDecimal} ${bq.assetSymbol} delivers in ~${remainingMin} min.\nReply with /ping ${bq.id} to reset, or /ping to reset all.`,
          );
        }
        sent += 1;
      } catch {
        // best-effort; we already wrote the dedupe row.
      }
    }
  }
  return { scanned: rows.length, sent };
}
