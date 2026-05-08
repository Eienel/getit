import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { createBequest } from "@/lib/bequest/create";
import { listBequestsForUser } from "@/lib/bequest/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const rows = await listBequestsForUser(session.userId);
    return Response.json({ bequests: rows.map(redact) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const result = await createBequest({
      userId: session.userId,
      title: body.title,
      beneficiaryAddress: String(body.beneficiaryAddress),
      assetSymbol: String(body.assetSymbol),
      assetChain: String(body.assetChain),
      amountDecimal: String(body.amountDecimal),
      checkinWindowSeconds: Number(body.checkinWindowSeconds),
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

function redact(b: Awaited<ReturnType<typeof listBequestsForUser>>[number]) {
  const { walletKeyCiphertext, walletKeyNonce, agentTokenCiphertext, agentTokenNonce, ...safe } = b;
  return safe;
}

function errorResponse(err: unknown) {
  const status = (err as { status?: number }).status ?? 400;
  return Response.json({ error: (err as Error).message }, { status });
}
