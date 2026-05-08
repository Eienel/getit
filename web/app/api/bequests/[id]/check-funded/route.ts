import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { maybeArmBequest } from "@/lib/bequest/arm";
import { getBequest } from "@/lib/bequest/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const b = await getBequest(params.id, session.userId);
    if (!b) return Response.json({ error: "Not found" }, { status: 404 });
    if (b.status !== "draft") return Response.json({ status: b.status, alreadyArmed: true });
    const result = await maybeArmBequest(params.id);
    return Response.json({ status: result.armed ? "armed" : "draft", ...result });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: (err as { status?: number }).status ?? 400 });
  }
}
