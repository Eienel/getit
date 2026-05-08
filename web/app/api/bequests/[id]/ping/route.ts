import { NextRequest, NextResponse } from "next/server";
import { getSession, requireSession } from "@/lib/auth";
import { pingBequest } from "@/lib/bequest/ping";
import { verifyToken } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/bequests/[id]/ping (web button)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const result = await pingBequest({ bequestId: params.id, source: "web", userId: session.userId });
    if (!result.ok) return Response.json({ error: "Cannot ping (status check)." }, { status: 400 });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: (err as { status?: number }).status ?? 400 });
  }
}

// GET /api/bequests/[id]/ping?via=email&t=<token>: one-tap email link.
// No auth required, but the token is HMAC-signed by us, single-purpose, time-bounded.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = req.nextUrl;
  const via = url.searchParams.get("via");
  const t = url.searchParams.get("t");

  if (via === "email" && t) {
    const decoded = verifyToken<{ kind: string; bequestId: string }>(t);
    if (!decoded || decoded.kind !== "ping" || decoded.bequestId !== params.id) {
      return new NextResponse("Link expired or invalid.", { status: 401 });
    }
    const result = await pingBequest({ bequestId: params.id, source: "email" });
    return new NextResponse(
      pingHtml({
        ok: result.ok,
        bequestId: params.id,
        nextDeadline: result.nextDeadline,
      }),
      { headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  // Fallback: web check-in via session
  const session = await getSession();
  if (!session) return new NextResponse("Sign in required.", { status: 401 });
  const result = await pingBequest({ bequestId: params.id, source: "web", userId: session.userId });
  return Response.json(result);
}

function pingHtml({ ok, bequestId, nextDeadline }: { ok: boolean; bequestId: string; nextDeadline: Date | null }) {
  const heading = ok ? "Clock reset." : "Ping not accepted.";
  const detail = ok && nextDeadline
    ? `Bequest <code>${bequestId}</code> resets. Next deadline ${nextDeadline.toUTCString()}.`
    : `The bequest may already be triggered, cancelled, or it was not awaiting a ping.`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${heading} · Bequest</title>
<style>body{font-family:Georgia,serif;background:#f4ede4;color:#1a1a1a;margin:0;padding:48px 16px}
.card{max-width:520px;margin:0 auto;text-align:center}
h1{font-family:'Playfair Display',Georgia,serif;font-weight:900;letter-spacing:0.02em;margin:.2em 0}
hr{border:none;border-top:3px double #1a1a1a;margin:8px 0 24px}
small{color:#7a7a7a}
a{color:#1a1a1a}
</style></head>
<body><div class="card">
<div style="text-transform:uppercase;letter-spacing:.15em;font-size:11px">Bequest · Vol. I</div>
<hr/>
<h1>${heading}</h1>
<p>${detail}</p>
<p><small>You can close this tab.</small></p>
</div></body></html>`;
}
