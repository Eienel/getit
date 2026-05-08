import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, setSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 400 });
  const session = await consumeMagicLink(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }
  await setSession(session);
  return NextResponse.redirect(new URL("/bequests", req.url));
}
