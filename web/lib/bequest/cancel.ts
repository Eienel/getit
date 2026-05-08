import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { sweepToOwner } from "./arm";
import type { Address } from "viem";
import { isAddress } from "viem";

export async function cancelBequest({
  bequestId,
  userId,
  ownerAddress,
}: {
  bequestId: string;
  userId: string;
  ownerAddress: string;
}): Promise<{ ok: true; sweepTxn: string | null } | { ok: false; reason: string }> {
  if (!isAddress(ownerAddress)) {
    return { ok: false, reason: "Owner address is not a valid 0x address." };
  }
  const rows = await db
    .select()
    .from(schema.bequests)
    .where(and(eq(schema.bequests.id, bequestId), eq(schema.bequests.userId, userId)))
    .limit(1);
  const b = rows[0];
  if (!b) return { ok: false, reason: "Bequest not found." };
  if (b.status !== "armed" && b.status !== "draft") {
    return { ok: false, reason: `Cannot cancel a bequest in status "${b.status}".` };
  }

  // Atomic flip
  const updated = await db
    .update(schema.bequests)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(and(eq(schema.bequests.id, bequestId), eq(schema.bequests.status, b.status)))
    .returning({ id: schema.bequests.id });
  if (updated.length === 0) return { ok: false, reason: "Concurrent state change; refresh and try again." };

  // If draft (never funded), nothing to sweep.
  if (b.status === "draft") return { ok: true, sweepTxn: null };

  // Sweep the funds back to the owner. Best-effort — if the sweep fails,
  // the bequest is still marked cancelled and the user retains the privkey
  // ciphertext to recover later.
  try {
    const result = await sweepToOwner({
      bequestId,
      toAddress: ownerAddress as Address,
    });
    return { ok: true, sweepTxn: result.hash };
  } catch (err) {
    return { ok: true, sweepTxn: null };
  }
}
