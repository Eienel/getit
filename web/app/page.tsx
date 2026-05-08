import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();
  return (
    <article className="space-y-10">
      <section className="text-center">
        <p className="smallcaps text-xs text-ink-faded">Editorial</p>
        <h2 className="font-display text-3xl sm:text-5xl mt-2 leading-tight">
          A crypto inheritance agent
          <br />
          <em className="font-normal">for what happens after.</em>
        </h2>
        <hr className="my-6" />
        <p className="font-display italic text-xl sm:text-2xl">
          &ldquo;Designate. Check in. Walk away.&rdquo;
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-base">
        <div>
          <h3 className="font-display text-lg uppercase tracking-smallcaps">I. The bequest</h3>
          <p className="mt-2">
            You name a beneficiary, an asset, a chain, and a check-in cadence. Bequest mints
            a fresh wallet for that single purpose — funds yours, not ours.
          </p>
        </div>
        <div>
          <h3 className="font-display text-lg uppercase tracking-smallcaps">II. The clock</h3>
          <p className="mt-2">
            As long as you check in — by web button, Telegram, or a one-tap email link —
            nothing happens. Reminders arrive at half-time, three-quarters, and final notice.
          </p>
        </div>
        <div>
          <h3 className="font-display text-lg uppercase tracking-smallcaps">III. The agent</h3>
          <p className="mt-2">
            If you stop checking in, an autonomous onchain agent — scoped to a single
            recipient on a single chain — delivers the transfer.
          </p>
        </div>
      </section>

      <hr />

      <section>
        <p className="smallcaps text-xs text-ink-faded">Front-page essay</p>
        <h3 className="font-display text-2xl sm:text-3xl mt-1">
          On policies, and the matter of god-mode agents.
        </h3>
        <div className="mt-4 sm:columns-2 sm:gap-8 text-justify col-rule">
          <p className="dropcap">
            An autonomous agent that can do anything is not an agent — it is a hostage
            situation. We have read the news from this decade and we believe in tools, not
            principalities. Each bequest is its own wallet. Each wallet has one job. Each
            agent is bound to one recipient on one chain, can grant no approvals, and
            holds only what you have entrusted to it.
          </p>
          <p className="mt-3">
            The forked Zerion CLI exposes the primitives we depend on — chain-locked
            policies, address-allowlist enforcement, and an approve-blocking gate that
            runs before signing. We use them. We do not use the parts that would give
            the agent more authority than the task requires. There is no swap path; there
            is no rebroadcast; there is no general-purpose key. The blast radius is the
            bequest.
          </p>
        </div>
      </section>

      <hr />

      <section className="text-center py-6">
        <Link href={session ? "/new" : "/login"} className="btn-solid">
          {session ? "Compose a bequest" : "Sign in"}
        </Link>
        <p className="mt-3 text-xs text-ink-faded">
          {session ? "" : "An email link is enough. No passwords."}
        </p>
      </section>
    </article>
  );
}
