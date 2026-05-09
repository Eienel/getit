import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getBequest } from "@/lib/bequest/queries";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lets the bequest owner export the per-bequest hot-wallet private key so they
// can take true custody (import into MetaMask, sweep funds elsewhere, etc.).
// Owner-scoped via getBequest(id, userId). Sensitive — never logged, never
// cached, no-store on every layer.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const b = await getBequest(params.id, session.userId);
    if (!b) return jsonNoStore({ error: "Not found" }, 404);

    const privateKey = decrypt(b.walletKeyCiphertext, b.walletKeyNonce, `wallet:${b.id}`);

    return jsonNoStore({
      walletAddress: b.walletAddress,
      privateKey,
      assetChain: b.assetChain,
      status: b.status,
    });
  } catch (err) {
    return jsonNoStore({ error: (err as Error).message }, (err as { status?: number }).status ?? 400);
  }
}

function jsonNoStore(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}
