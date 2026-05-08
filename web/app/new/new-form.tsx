"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const CHAINS = ["base", "ethereum", "optimism", "arbitrum"] as const;
const ASSETS = ["USDC", "ETH"] as const;

const WINDOW_OPTIONS = [
  { label: "60 seconds (demo)", value: 60 },
  { label: "5 minutes", value: 300 },
  { label: "1 day", value: 86400 },
  { label: "7 days", value: 604800 },
  { label: "30 days", value: 2592000 },
  { label: "90 days", value: 7776000 },
];

export function NewBequestForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("USDC");
  const [chain, setChain] = useState<(typeof CHAINS)[number]>("base");
  const [amount, setAmount] = useState("0.01");
  const [checkin, setCheckin] = useState(60);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bequests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          beneficiaryAddress: beneficiary,
          assetSymbol: asset,
          assetChain: chain,
          amountDecimal: amount,
          checkinWindowSeconds: checkin,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      router.push(`/fund/${j.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="label" htmlFor="title">Bequest title (optional)</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. To Sarah, my sister"
          className="input"
        />
      </div>

      <div>
        <label className="label" htmlFor="beneficiary">Beneficiary address (0x…)</label>
        <input
          id="beneficiary"
          required
          value={beneficiary}
          onChange={(e) => setBeneficiary(e.target.value)}
          placeholder="0x0000…"
          className="input font-mono text-sm"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <label className="label" htmlFor="asset">Asset</label>
          <select id="asset" value={asset} onChange={(e) => setAsset(e.target.value as typeof asset)} className="input">
            {ASSETS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="chain">Chain</label>
          <select id="chain" value={chain} onChange={(e) => setChain(e.target.value as typeof chain)} className="input">
            {CHAINS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input
            id="amount"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="checkin">Check-in cadence</label>
        <select
          id="checkin"
          value={checkin}
          onChange={(e) => setCheckin(Number(e.target.value))}
          className="input"
        >
          {WINDOW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-xs text-ink-faded mt-1">
          You must check in (web button, Telegram, or email) within this window or the bequest delivers.
        </p>
      </div>

      {error && (
        <p className="badge text-accent" style={{ borderColor: "#8b1c1c" }}>{error}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button type="submit" disabled={busy} className="btn-solid flex-1">
          {busy ? "Drafting…" : "Mint the wallet"}
        </button>
      </div>
      <p className="text-xs text-ink-faded">
        Mints a fresh wallet and a scoped agent token. The agent token is bound to the
        beneficiary on this chain, blocks ERC-20 approvals, and expires in 30 days.
      </p>
    </form>
  );
}
