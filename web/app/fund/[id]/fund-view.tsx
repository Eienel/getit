"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

type Props = {
  bequest: {
    id: string;
    walletAddress: string;
    assetSymbol: string;
    assetChain: string;
    amountDecimal: string;
    beneficiaryAddress: string;
    checkinWindowSeconds: number;
  };
  explorerUrl: string;
};

const CHAIN_HINT: Record<string, string> = {
  base: "Base",
  ethereum: "Ethereum",
  optimism: "Optimism",
  arbitrum: "Arbitrum",
};

export function FundView({ bequest, explorerUrl }: Props) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [polling, setPolling] = useState(true);
  const [last, setLast] = useState<{ balance?: string; required?: string } | null>(null);
  const [armed, setArmed] = useState(false);

  // The EIP-681 URI lets phone wallets one-tap. We only emit it for native
  // sends (it doesn't reliably encode ERC-20 transfers across wallets).
  const uri = `ethereum:${bequest.walletAddress}@${chainIdOf(bequest.assetChain)}`;

  useEffect(() => {
    QRCode.toDataURL(uri, { margin: 1, color: { dark: "#1a1a1a", light: "#f4ede4" }, width: 320 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [uri]);

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/bequests/${bequest.id}/check-funded`, { method: "POST" });
        const j = await res.json();
        if (cancelled) return;
        setLast({ balance: j.balance, required: j.required });
        if (j.status === "armed") {
          setArmed(true);
          setPolling(false);
          setTimeout(() => router.push(`/bequests/${bequest.id}`), 1200);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 8_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [polling, bequest.id, router]);

  return (
    <div className="space-y-6">
      <div className="border border-ink p-4 sm:p-6 bg-paper-dark/30">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="smallcaps text-xs text-ink-faded">Bequest</p>
            <p className="font-display text-xl">{bequest.id}</p>
          </div>
          <span className={`badge ${armed ? "badge-solid" : ""}`}>{armed ? "ARMED" : "DRAFT"}</span>
        </div>
        <hr className="my-4" />
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink-faded">To</dt>
          <dd className="font-mono break-all">{shortAddr(bequest.beneficiaryAddress)}</dd>
          <dt className="text-ink-faded">Amount</dt>
          <dd>{bequest.amountDecimal} {bequest.assetSymbol}</dd>
          <dt className="text-ink-faded">Chain</dt>
          <dd>{CHAIN_HINT[bequest.assetChain] ?? bequest.assetChain}</dd>
          <dt className="text-ink-faded">Cadence</dt>
          <dd>{formatSec(bequest.checkinWindowSeconds)}</dd>
        </dl>
      </div>

      <div className="text-center">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Deposit QR" className="mx-auto border border-ink" width={260} height={260} />
        ) : (
          <div className="h-[260px] w-[260px] mx-auto border border-ink flex items-center justify-center text-ink-faded">QR loading…</div>
        )}
        <p className="mt-3 font-mono text-sm break-all px-2">{bequest.walletAddress}</p>
        <a className="text-xs underline mt-1 inline-block" href={explorerUrl} target="_blank" rel="noreferrer">
          View on explorer
        </a>
      </div>

      <div className="text-sm space-y-3 leading-relaxed">
        <p>
          Send <strong>{bequest.amountDecimal} {bequest.assetSymbol}</strong>
          {bequest.assetSymbol !== "ETH" && (
            <> plus a small allowance of <strong>ETH</strong> for gas (≈ $0.50)</>
          )}{" "}
          to the address above on <strong>{CHAIN_HINT[bequest.assetChain] ?? bequest.assetChain}</strong>.
        </p>
        <p className="text-ink-faded">
          We poll the chain every 8 seconds. The page will arm itself automatically once funds arrive.
        </p>
        {last?.balance && last?.required && (
          <p className="text-xs text-ink-faded">Currently holding: {last.balance} (need {last.required})</p>
        )}
      </div>

      {armed && (
        <p className="badge-solid w-full text-center py-2">
          Funds detected. Arming the agent…
        </p>
      )}
    </div>
  );
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

function chainIdOf(chain: string) {
  switch (chain) {
    case "base":
      return 8453;
    case "ethereum":
      return 1;
    case "optimism":
      return 10;
    case "arbitrum":
      return 42161;
    default:
      return 1;
  }
}
