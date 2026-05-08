import { NextRequest } from "next/server";
import { issueNonce, buildMessage } from "@/lib/siwe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/siwe/nonce: caller posts {address, chainId}; server returns
// the EIP-4361 message text to sign + an opaque nonce token to round-trip back.
// The nonce token is HMAC-signed; we don't need a DB row to track it.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = String(body.address || "").toLowerCase();
    const chainId = Number(body.chainId);
    if (!/^0x[0-9a-f]{40}$/.test(address)) {
      return Response.json({ error: "Invalid address." }, { status: 400 });
    }
    if (!Number.isFinite(chainId) || chainId <= 0) {
      return Response.json({ error: "Invalid chainId." }, { status: 400 });
    }

    const url = new URL(req.url);
    const origin = `${url.protocol}//${url.host}`;
    const domain = url.host;

    const { nonce, token } = issueNonce();
    const message = buildMessage({
      domain,
      origin,
      address: address as `0x${string}`,
      chainId,
      nonce,
    });
    return Response.json({ message, nonce, token });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
