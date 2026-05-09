"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  bequest: {
    id: string;
    status: string;
    title: string | null;
    beneficiaryAddress: string;
    assetSymbol: string;
    assetChain: string;
    amountDecimal: string;
    walletAddress: string;
    checkinWindowSeconds: number;
    lastPingAt: string | null;
    deadline: string | null;
    txnHash: string | null;
    triggeredAt: string | null;
    cancelledAt: string | null;
    failureReason: string | null;
  };
  policy: { name: string; chain: string; expiresAt: string; allowedAddresses: string[]; denyApprovals: boolean } | null;
  explorer: { txUrl: string | null; walletUrl: string };
};

export function BequestDetailClient({ bequest: initial, policy, explorer }: Props) {
  const router = useRouter();
  const [bequest, setBequest] = useState(initial);
  const [, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [tgUrl, setTgUrl] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [ownerAddr, setOwnerAddr] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Export-private-key state. The key is only fetched after the user explicitly
  // clicks through the warning, and is wiped from React state when the modal
  // closes. We never persist it client-side.
  const [showKey, setShowKey] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // Tick local clock every second for the countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll the server for status changes (so a cron-fire shows up without manual refresh)
  useEffect(() => {
    if (bequest.status !== "armed") return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/bequests/${bequest.id}`);
        if (!res.ok) return;
        const j = await res.json();
        if (j.status !== bequest.status || j.lastPingAt !== bequest.lastPingAt || j.txnHash !== bequest.txnHash) {
          router.refresh();
        }
      } catch {}
    }, 8000);
    return () => clearInterval(id);
  }, [bequest.status, bequest.id, bequest.lastPingAt, bequest.txnHash, router]);

  const remainingMs = useMemo(() => {
    if (!bequest.deadline) return null;
    return new Date(bequest.deadline).getTime() - Date.now();
  }, [bequest.deadline]);

  async function ping() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bequests/${bequest.id}/ping`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setBequest((b) => ({ ...b, lastPingAt: new Date().toISOString(), deadline: j.nextDeadline }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function connectTelegram() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/telegram/link`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setTgUrl(j.url);
      window.open(j.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revealKey() {
    setKeyBusy(true);
    setKeyError(null);
    try {
      const res = await fetch(`/api/bequests/${bequest.id}/private-key`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setKeyValue(j.privateKey as string);
    } catch (err) {
      setKeyError((err as Error).message);
    } finally {
      setKeyBusy(false);
    }
  }

  function closeKeyModal() {
    setShowKey(false);
    setKeyValue(null);
    setKeyError(null);
    setKeyCopied(false);
  }

  async function copyKey() {
    if (!keyValue) return;
    try {
      await navigator.clipboard.writeText(keyValue);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      setKeyError("Could not copy. Select and copy the key manually.");
    }
  }

  async function cancel() {
    if (!ownerAddr.trim()) {
      setError("Provide an owner address to receive the swept funds.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bequests/${bequest.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerAddress: ownerAddr }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      router.refresh();
      setShowCancel(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="space-y-6">
      <header>
        <p className="smallcaps text-xs text-ink-faded text-center">Bequest of record</p>
        <h2 className="font-display text-3xl sm:text-4xl mt-2 text-center">
          {bequest.title || `${bequest.amountDecimal} ${bequest.assetSymbol}`}
        </h2>
        <p className="text-center text-ink-faded mt-1 font-mono text-sm">{bequest.id}</p>
        <hr className="my-6" />
      </header>

      <section className="border border-ink p-4 sm:p-6 bg-paper-dark/30 text-center">
        <p className="smallcaps text-xs text-ink-faded">Status</p>
        <p className="font-display text-3xl mt-1">
          <StatusBadge status={bequest.status} />
        </p>

        {bequest.status === "armed" && remainingMs != null && (
          <>
            <p className="smallcaps text-xs text-ink-faded mt-6">Time until delivery</p>
            <p className="font-display text-5xl sm:text-6xl mt-1 tabular-nums">
              {formatRemaining(remainingMs)}
            </p>
            <p className="text-xs text-ink-faded mt-1">
              Deadline {bequest.deadline && new Date(bequest.deadline).toUTCString()}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
              <button onClick={ping} disabled={busy} className="btn-solid">
                {busy ? "…" : "I am alive · reset clock"}
              </button>
              <button onClick={connectTelegram} disabled={busy} className="btn">
                Connect Telegram
              </button>
            </div>
            {tgUrl && (
              <p className="text-xs text-ink-faded mt-3">
                Bot opened in a new tab. Tap <em>Start</em> to link.
              </p>
            )}
          </>
        )}

        {bequest.status === "triggered" && (
          <>
            <p className="mt-4">Delivered to <span className="font-mono">{shortAddr(bequest.beneficiaryAddress)}</span></p>
            {bequest.txnHash && explorer.txUrl && (
              <p className="mt-2">
                <a href={explorer.txUrl} target="_blank" rel="noreferrer" className="font-mono text-sm">
                  {bequest.txnHash.slice(0, 12)}…
                </a>
              </p>
            )}
            {bequest.triggeredAt && (
              <p className="text-xs text-ink-faded mt-1">{new Date(bequest.triggeredAt).toUTCString()}</p>
            )}
          </>
        )}

        {bequest.status === "cancelled" && bequest.cancelledAt && (
          <p className="mt-2 text-ink-faded">Cancelled {new Date(bequest.cancelledAt).toUTCString()}.</p>
        )}

        {bequest.status === "failed" && (
          <p className="mt-2 text-accent">Delivery failed: {bequest.failureReason}</p>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="font-display text-lg uppercase tracking-smallcaps">Particulars</h3>
          <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-faded">Beneficiary</dt>
            <dd className="font-mono break-all">{shortAddr(bequest.beneficiaryAddress)}</dd>
            <dt className="text-ink-faded">Amount</dt>
            <dd>{bequest.amountDecimal} {bequest.assetSymbol}</dd>
            <dt className="text-ink-faded">Chain</dt>
            <dd>{bequest.assetChain}</dd>
            <dt className="text-ink-faded">Cadence</dt>
            <dd>{formatSec(bequest.checkinWindowSeconds)}</dd>
            <dt className="text-ink-faded">Wallet</dt>
            <dd className="font-mono break-all">
              <a href={explorer.walletUrl} target="_blank" rel="noreferrer">{shortAddr(bequest.walletAddress)}</a>
            </dd>
          </dl>
          <button
            type="button"
            onClick={() => setShowKey(true)}
            className="mt-3 text-xs uppercase tracking-smallcaps underline"
          >
            Export private key
          </button>
          <p className="text-xs text-ink-faded mt-1">Take true custody of this wallet.</p>
        </div>

        <div>
          <h3 className="font-display text-lg uppercase tracking-smallcaps">Scoped policy</h3>
          {policy ? (
            <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-ink-faded">Name</dt>
              <dd className="font-mono">{policy.name}</dd>
              <dt className="text-ink-faded">Chain</dt>
              <dd>locked to {policy.chain}</dd>
              <dt className="text-ink-faded">Allowlist</dt>
              <dd className="font-mono">{policy.allowedAddresses.map(shortAddr).join(", ")}</dd>
              <dt className="text-ink-faded">Approvals</dt>
              <dd>{policy.denyApprovals ? "denied" : "permitted"}</dd>
              <dt className="text-ink-faded">Expires</dt>
              <dd>{new Date(policy.expiresAt).toUTCString()}</dd>
            </dl>
          ) : (
            <p className="mt-2 text-ink-faded">No policy yet. Fund the wallet to arm it.</p>
          )}
          <p className="text-xs text-ink-faded mt-3">
            This token can only send to the allowlisted address on {policy?.chain ?? "the chain"}, and cannot grant ERC-20 approvals.
          </p>
        </div>
      </section>

      {error && <p className="badge text-accent" style={{ borderColor: "#8b1c1c" }}>{error}</p>}

      {showKey && (
        <ExportKeyModal
          walletAddress={bequest.walletAddress}
          chain={bequest.assetChain}
          status={bequest.status}
          keyValue={keyValue}
          busy={keyBusy}
          error={keyError}
          copied={keyCopied}
          onReveal={revealKey}
          onCopy={copyKey}
          onClose={closeKeyModal}
        />
      )}

      {bequest.status === "armed" && (
        <section className="mt-8">
          <hr className="mb-4" />
          {!showCancel ? (
            <button onClick={() => setShowCancel(true)} className="btn">Cancel the bequest</button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Cancellation sweeps the bequest funds back to an owner address. Provide it
                below.
              </p>
              <input
                value={ownerAddr}
                onChange={(e) => setOwnerAddr(e.target.value)}
                placeholder="0x your owner address"
                className="input font-mono text-sm"
              />
              <div className="flex gap-3">
                <button onClick={cancel} disabled={busy} className="btn-solid">
                  {busy ? "Sweeping…" : "Confirm cancellation"}
                </button>
                <button onClick={() => setShowCancel(false)} disabled={busy} className="btn">
                  Keep
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

function ExportKeyModal(props: {
  walletAddress: string;
  chain: string;
  status: string;
  keyValue: string | null;
  busy: boolean;
  error: string | null;
  copied: boolean;
  onReveal: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
  const { walletAddress, chain, status, keyValue, busy, error, copied, onReveal, onCopy, onClose } = props;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export private key"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-w-lg w-full bg-paper border border-ink p-5 sm:p-6 shadow-newsprint"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl">Export private key</h3>
          <button onClick={onClose} className="text-xl leading-none" aria-label="Close">×</button>
        </div>

        <p className="mt-3 text-sm">
          You hold the keys. The signing key for this per-bequest wallet is yours
          to take. Anyone with this key controls the funds &mdash; treat it like
          cash.
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-y-1 text-xs">
          <dt className="text-ink-faded uppercase tracking-smallcaps">Address</dt>
          <dd className="col-span-2 font-mono break-all">{walletAddress}</dd>
          <dt className="text-ink-faded uppercase tracking-smallcaps">Chain</dt>
          <dd className="col-span-2">{chain}</dd>
        </dl>

        <hr className="my-4" />

        {!keyValue ? (
          <>
            <ul className="text-sm text-ink-faded space-y-1 list-disc pl-5 mb-4">
              <li>Anyone with this key can drain the wallet, including before the bequest fires.</li>
              <li>If you import it elsewhere and move funds, the agent loop has nothing to deliver.</li>
              <li>Bequest will keep checking in &mdash; cancel it if you no longer want it armed.</li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={onReveal} disabled={busy} className="btn-solid flex-1">
                {busy ? "Decrypting…" : "Reveal private key"}
              </button>
              <button onClick={onClose} disabled={busy} className="btn">Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className="smallcaps text-xs text-ink-faded">Private key (hex)</p>
            <pre className="font-mono text-xs break-all whitespace-pre-wrap mt-1 p-3 border border-ink bg-paper-dark/30">
              {keyValue}
            </pre>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button onClick={onCopy} className="btn-solid flex-1">
                {copied ? "Copied" : "Copy to clipboard"}
              </button>
              <button onClick={onClose} className="btn">Done</button>
            </div>
            <p className="text-xs text-ink-faded mt-3">
              In MetaMask: <em>Account menu &rarr; Add account &rarr; Import account &rarr; Private key</em>.
              Make sure your wallet is on the {chain} network to see the balance.
              {status === "triggered" && " (Note: this bequest already delivered; the wallet is empty.)"}
            </p>
          </>
        )}

        {error && <p className="text-sm text-accent mt-3">{error}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "armed"
      ? "badge"
      : status === "triggered"
        ? "badge-solid"
        : status === "cancelled" || status === "failed"
          ? "badge"
          : "badge";
  return <span className={cls}>{status.toUpperCase()}</span>;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatSec(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "0s";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h.toString().padStart(2, "0")}h`;
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
