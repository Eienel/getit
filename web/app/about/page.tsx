export default function AboutPage() {
  return (
    <article className="max-w-2xl mx-auto">
      <p className="smallcaps text-xs text-ink-faded text-center">Editorial</p>
      <h2 className="font-display text-3xl sm:text-4xl mt-2 text-center">
        On building an inheritance agent
      </h2>
      <p className="text-center italic text-ink-faded mt-1">A reader's note</p>
      <hr className="my-6" />

      <section className="sm:columns-2 sm:gap-8 col-rule text-justify leading-relaxed">
        <p className="dropcap">
          Some lessons of the present decade — the bridges that fail, the rugs that
          pull, the tokens whose original holders forget the seed — accumulate slowly
          until one day they are the entire weather of the place. We have been told,
          repeatedly, that an autonomous agent will solve our problems. The proposed
          agents are usually larger than the problem they solve. They hold our keys.
          They speak for us in places we would not authorize them to speak. They have
          opinions about which DEX to use.
        </p>
        <p className="mt-4">
          Bequest is the smallest agent we could imagine that still does something
          worth doing. Each instance is bound to one beneficiary on one chain. It
          cannot grant approvals. It cannot swap. It does not hold funds beyond what
          you bequeathed; the bequest wallet is its own custody, isolated from your
          main holdings. There is no API key stored alongside it, no LLM in the
          decision loop, no "fall back to" path. The agent's job, in full, is: when
          the dead-man timer expires, sign the one transaction it was authorized to
          sign.
        </p>
        <p className="mt-4">
          We forked the Zerion CLI because its primitives — chain locks, recipient
          allowlists, approval-blocking gates, and the executable-policy dispatcher —
          are exactly what an agent of this shape requires. We did not extend them. We
          did not add new capabilities to the agent token. We removed the parts we did
          not need. The result is, we hope, boring in the way infrastructure should be
          boring.
        </p>
        <p className="mt-4">
          A few notes on what is genuinely difficult, and what we ducked. Crypto
          inheritance is not a key-management problem. It is a notification problem,
          a coordination problem with bereaved relatives, and a problem of trusting
          that the agent you set up two years ago will still be running when it is
          needed. Bequest sends nudges by email and by Telegram so that the
          notification problem is at least visible to the user; the coordination
          problem with relatives we leave to the relatives; the longevity problem we
          leave for our successors. If we have done our work, you will be able to
          rebuild Bequest from the public source and rerun your dead-man's switch on
          your own infrastructure. We expect, in the long arc, you will. That is a
          good outcome.
        </p>
        <p className="mt-4 text-ink-faded text-sm">
          — The Editorial Board
        </p>
      </section>

      <hr className="my-8" />

      <section>
        <h3 className="font-display text-xl uppercase tracking-smallcaps">Construction notes</h3>
        <ul className="mt-3 list-disc pl-5 space-y-2 text-sm">
          <li>
            <strong>Forked Zerion CLI</strong> — the runtime for transfer construction, policy
            schema, and Zerion API auth. See <code>/cli/</code> in the source repo.
          </li>
          <li>
            <strong>Per-bequest hot wallet</strong> — privkey encrypted at rest with envelope
            AES-GCM (HKDF over a master key). For a production deployment, swap to KMS or
            Turnkey; for the hackathon, keys are written into Postgres.
          </li>
          <li>
            <strong>Scoped agent token</strong> — chain-locked, allowlist of one recipient,
            approval calls denied, expires in 30 days. Defined in <code>web/lib/zerion/policy.ts</code>,
            faithful to <code>cli/policies/{"{allowlist,deny-approvals}"}.mjs</code>.
          </li>
          <li>
            <strong>Watcher</strong> — Vercel Cron runs every minute, reads expired bequests,
            atomically flips status to <em>triggered</em> before broadcasting. Idempotent on
            transaction hash.
          </li>
          <li>
            <strong>Notifications</strong> — Resend for email, Telegram bot for chat, both
            sending nudges at 50%, 75%, and 90% of the check-in window.
          </li>
        </ul>
      </section>
    </article>
  );
}
