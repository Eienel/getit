import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}

export async function GET(req: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
