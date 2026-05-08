import { NextRequest } from "next/server";
import { verifySiwe } from "@/lib/siwe";
import { setSession, upsertUserByEthAddress } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/siwe/verify: caller posts {message, signature, token}.
// On success: upsert user, set session cookie, return 200 + redirect path.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = body.message;
    const signature: string = body.signature;
    const token: string = body.token;
    if (!message || !signature || !token) {
      return Response.json({ error: "Missing message, signature, or token." }, { status: 400 });
    }

    const url = new URL(req.url);
    const result = await verifySiwe({
      message,
      signature: signature as `0x${string}`,
      nonceToken: token,
      expectedDomain: url.host,
    });
    if (!result.ok) {
      return Response.json({ error: result.reason }, { status: 401 });
    }

    const { userId, ethAddress } = await upsertUserByEthAddress(result.address);
    await setSession({ userId, ethAddress });

    return Response.json({ ok: true, redirect: "/bequests", userId, ethAddress });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
