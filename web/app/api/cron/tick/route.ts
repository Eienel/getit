import { NextRequest } from "next/server";
import { tick } from "@/lib/bequest/tick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const result = await tick();
  return Response.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
