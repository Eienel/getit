import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBequest, deadlineOf } from "@/lib/bequest/queries";
import { explorerTxUrl, explorerAddressUrl } from "@/lib/bequest/explorer";
import { BequestDetailClient } from "./detail-client";

export const dynamic = "force-dynamic";

export default async function BequestDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const b = await getBequest(params.id, session.userId);
  if (!b) notFound();
  if (b.status === "draft") redirect(`/fund/${b.id}`);

  const deadline = deadlineOf(b);
  let policy: { name: string; chain: string; expiresAt: string; allowedAddresses: string[]; denyApprovals: boolean } | null = null;
  try {
    policy = b.policyJson ? JSON.parse(b.policyJson) : null;
  } catch {}

  return (
    <BequestDetailClient
      bequest={{
        id: b.id,
        status: b.status,
        title: b.title,
        beneficiaryAddress: b.beneficiaryAddress,
        assetSymbol: b.assetSymbol,
        assetChain: b.assetChain,
        amountDecimal: b.amountDecimal,
        walletAddress: b.walletAddress,
        checkinWindowSeconds: b.checkinWindowSeconds,
        lastPingAt: b.lastPingAt?.toISOString() ?? null,
        deadline: deadline?.toISOString() ?? null,
        txnHash: b.txnHash,
        triggeredAt: b.triggeredAt?.toISOString() ?? null,
        cancelledAt: b.cancelledAt?.toISOString() ?? null,
        failureReason: b.failureReason,
      }}
      policy={policy}
      explorer={{
        txUrl: b.txnHash ? explorerTxUrl(b.assetChain, b.txnHash) : null,
        walletUrl: explorerAddressUrl(b.assetChain, b.walletAddress),
      }}
    />
  );
}
