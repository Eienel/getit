import { eq, and } from "drizzle-orm";
import { db, schema } from "../db";

export async function pingBequest({
  bequestId,
  source,
  userId,
}: {
  bequestId: string;
  source: "web" | "telegram" | "email";
  userId?: string;
}): Promise<{ ok: boolean; nextDeadline: Date | null }> {
  const rows = await db
    .select()
    .from(schema.bequests)
    .where(eq(schema.bequests.id, bequestId))
    .limit(1);
  const b = rows[0];
  if (!b) return { ok: false, nextDeadline: null };
  if (userId && b.userId !== userId) return { ok: false, nextDeadline: null };
  if (b.status !== "armed") return { ok: false, nextDeadline: null };

  const now = new Date();
  await db
    .update(schema.bequests)
    .set({ lastPingAt: now })
    .where(and(eq(schema.bequests.id, bequestId), eq(schema.bequests.status, "armed")));

  await db.insert(schema.pingLogs).values({
    bequestId,
    source,
  });

  const nextDeadline = new Date(now.getTime() + b.checkinWindowSeconds * 1000);
  return { ok: true, nextDeadline };
}

export async function pingAllForUser(userId: string, source: "telegram"): Promise<number> {
  const rows = await db
    .select({ id: schema.bequests.id })
    .from(schema.bequests)
    .where(and(eq(schema.bequests.userId, userId), eq(schema.bequests.status, "armed")));
  let count = 0;
  for (const r of rows) {
    const res = await pingBequest({ bequestId: r.id, source });
    if (res.ok) count += 1;
  }
  return count;
}
