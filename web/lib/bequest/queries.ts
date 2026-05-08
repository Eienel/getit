import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";

export async function listBequestsForUser(userId: string) {
  return db
    .select()
    .from(schema.bequests)
    .where(eq(schema.bequests.userId, userId))
    .orderBy(desc(schema.bequests.createdAt));
}

export async function getBequest(id: string, userId?: string) {
  const where = userId
    ? and(eq(schema.bequests.id, id), eq(schema.bequests.userId, userId))
    : eq(schema.bequests.id, id);
  const rows = await db.select().from(schema.bequests).where(where).limit(1);
  return rows[0] ?? null;
}

export type BequestRow = NonNullable<Awaited<ReturnType<typeof getBequest>>>;

export function deadlineOf(b: BequestRow): Date | null {
  if (!b.lastPingAt) return null;
  return new Date(new Date(b.lastPingAt).getTime() + b.checkinWindowSeconds * 1000);
}
