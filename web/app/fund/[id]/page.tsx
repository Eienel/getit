import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBequest } from "@/lib/bequest/queries";
import { FundView } from "./fund-view";
import { explorerAddressUrl } from "@/lib/bequest/explorer";

export default async function FundPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const b = await getBequest(params.id, session.userId);
  if (!b) redirect("/bequests");
  if (b.status !== "draft") redirect(`/bequests/${b.id}`);

  return (
    <article className="max-w-2xl mx-auto">
      <p className="smallcaps text-xs text-ink-faded text-center">Step two</p>
      <h2 className="font-display text-3xl sm:text-4xl mt-2 text-center">Fund the bequest</h2>
      <hr className="my-6" />

      <FundView
        bequest={{
          id: b.id,
          walletAddress: b.walletAddress,
          assetSymbol: b.assetSymbol,
          assetChain: b.assetChain,
          amountDecimal: b.amountDecimal,
          beneficiaryAddress: b.beneficiaryAddress,
          checkinWindowSeconds: b.checkinWindowSeconds,
        }}
        explorerUrl={explorerAddressUrl(b.assetChain, b.walletAddress)}
      />
    </article>
  );
}
