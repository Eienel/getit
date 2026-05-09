import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getBequest, deadlineOf } from "@/lib/bequest/queries";
import { cancelBequest } from "@/lib/bequest/cancel";
import { tickOne } from "@/lib/bequest/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    let b = await getBequest(params.id, session.userId);
    if (!b) return Response.json({ error: "Not found" }, { status: 404 });

    // Self-tick: if armed and past deadline, fire this bequest inline.
    // tickOne is idempotent and isolated to this id (no global scan, no head-
    // of-line blocking from other expired bequests). Errors are surfaced as
    // `lastTickError` on the response so the UI can show what's wrong, instead
    // of the previous silent `.catch(() => {})` which made everything look
    // like "stuck armed".
    let lastTickError: string | null = null;
    if (b.status === "armed") {
      const dl = deadlineOf(b);
      if (dl && dl < new Date()) {
        try {
          const out = await tickOne(b.id);
          if (out.result === "failed") lastTickError = out.error;
        } catch (e) {
          lastTickError = (e as Error).message;
          console.error("tickOne threw for", b.id, e);
        }
        b = await getBequest(params.id, session.userId);
        if (!b) return Response.json({ error: "Not found" }, { status: 404 });
      }
    }

    const { walletKeyCiphertext, walletKeyNonce, agentTokenCiphertext, agentTokenNonce, ...safe } = b;
    return Response.json(
      { ...safe, lastTickError },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: (err as { status?: number }).status ?? 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const ownerAddress = String(body.ownerAddress || "").trim();
    if (!ownerAddress) {
      return Response.json({ error: "Provide ownerAddress to sweep funds back to." }, { status: 400 });
    }
    const result = await cancelBequest({
      bequestId: params.id,
      userId: session.userId,
      ownerAddress,
    });
    if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: (err as { status?: number }).status ?? 400 });
  }
}
