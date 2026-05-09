import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getBequest } from "@/lib/bequest/queries";
import { tickOne } from "@/lib/bequest/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual single-bequest fire — owner-scoped diagnostic. Surfaces the exact
// outcome (fired / failed / not-expired / race) and the underlying error,
// unlike the silently-caught self-tick path. Used by the "Fire now" button on
// the detail page when the auto-firing isn't visibly working.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const b = await getBequest(params.id, session.userId);
    if (!b) return Response.json({ error: "Not found" }, { status: 404 });

    const out = await tickOne(b.id);
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message, stack: (err as Error).stack },
      { status: (err as { status?: number }).status ?? 500 },
    );
  }
}
