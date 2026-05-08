import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listBequestsForUser } from "@/lib/bequest/queries";

export default async function BequestsListPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const rows = await listBequestsForUser(session.userId);

  return (
    <article>
      <p className="smallcaps text-xs text-ink-faded text-center">Public notices</p>
      <h2 className="font-display text-3xl sm:text-4xl mt-2 text-center">Your bequests</h2>
      <hr className="my-6" />

      {rows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-faded mb-4">You have no bequests on record.</p>
          <Link href="/new" className="btn-solid">Compose the first</Link>
        </div>
      ) : (
        <ul className="divide-y divide-ink">
          {rows.map((b) => {
            const deadline = b.lastPingAt
              ? new Date(new Date(b.lastPingAt).getTime() + b.checkinWindowSeconds * 1000)
              : null;
            return (
              <li key={b.id} className="py-4">
                <Link href={`/bequests/${b.id}`} className="no-underline block hover:bg-paper-dark/30 px-2 -mx-2 py-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-display text-lg">
                      {b.title || `${b.amountDecimal} ${b.assetSymbol} on ${b.assetChain}`}
                    </span>
                    <span className={`badge ${b.status === "armed" ? "" : b.status === "triggered" ? "badge-solid" : ""}`}>
                      {b.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 text-sm mt-1 text-ink-faded">
                    <span className="font-mono">{b.id}</span>
                    {deadline && b.status === "armed" && (
                      <span>Deadline {deadline.toUTCString()}</span>
                    )}
                    {b.status === "triggered" && b.txnHash && (
                      <span className="font-mono truncate max-w-[40%]">tx {b.txnHash.slice(0, 10)}…</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="text-center mt-8">
        <Link href="/new" className="btn">+ New bequest</Link>
      </div>
    </article>
  );
}
