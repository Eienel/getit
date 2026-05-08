import { NextRequest } from "next/server";
import { startMagicLinkLogin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return Response.json({ error: "Email is required." }, { status: 400 });
    const appUrl = process.env.APP_URL || new URL(req.url).origin;
    await startMagicLinkLogin(email, appUrl);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
