import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getBequest, deadlineOf } from "@/lib/bequest/queries";
import { cancelBequest } from "@/lib/bequest/cancel";
import { tick } from "@/lib/bequest/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    let b = await getBequest(params.id, session.userId);
    if (!b) return Response.json({ error: "Not found" }, { status: 404 });

    // Self-tick: if this armed bequest is past its deadline, fire the watcher
    // inline. tick() is idempotent (atomic UPDATE … WHERE status='armed'), so
    // concurrent calls are safe. Vercel Hobby caps cron at once-per-day, so we
    // rely on the detail page's 8s poll to drive the watcher during demos.
    if (b.status === "armed") {
      const dl = deadlineOf(b);
      if (dl && dl < new Date()) {
        await tick().catch(() => {});
        b = await getBequest(params.id, session.userId);
        if (!b) return Response.json({ error: "Not found" }, { status: 404 });
      }
    }

    const { walletKeyCiphertext, walletKeyNonce, agentTokenCiphertext, agentTokenNonce, ...safe } = b;
    return Response.json(safe);
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
