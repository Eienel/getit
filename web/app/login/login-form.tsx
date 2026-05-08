"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type EthereumProvider = {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRainbow?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const ACCEPTED_CHAINS: Record<number, string> = {
  8453: "Base",
  1: "Ethereum",
  10: "Optimism",
  42161: "Arbitrum",
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const error = params.get("error");
  const [hasInjected, setHasInjected] = useState(false);
  const [siweBusy, setSiweBusy] = useState(false);
  const [siweError, setSiweError] = useState<string | null>(null);

  // Email path
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    setHasInjected(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  async function signInWithEthereum() {
    setSiweBusy(true);
    setSiweError(null);
    try {
      if (!window.ethereum) {
        throw new Error("No wallet detected. Open this page inside your wallet's in-app browser.");
      }
      // 1. Connect / request accounts
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const address = (accounts && accounts[0])?.toLowerCase();
      if (!address) throw new Error("No account exposed by wallet.");

      // 2. Determine chainId
      const chainHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      const chainId = parseInt(chainHex, 16);
      if (!ACCEPTED_CHAINS[chainId]) {
        // Suggest switching to Base
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }], // Base
          });
        } catch {
          throw new Error(
            `Connected to chain ${chainId} which is not supported. Switch to Base, Ethereum, Optimism, or Arbitrum and try again.`,
          );
        }
      }
      const finalChainHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      const finalChainId = parseInt(finalChainHex, 16);

      // 3. Get a SIWE message + nonce token
      const nonceRes = await fetch("/api/auth/siwe/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chainId: finalChainId }),
      });
      const nonceJson = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nonceJson.error || `HTTP ${nonceRes.status}`);
      const { message, token } = nonceJson as { message: string; token: string };

      // 4. Sign via personal_sign
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      // 5. Verify on the server
      const verifyRes = await fetch("/api/auth/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, token }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyJson.error || `HTTP ${verifyRes.status}`);

      router.push(verifyJson.redirect || "/bequests");
      router.refresh();
    } catch (err) {
      setSiweError((err as Error).message);
    } finally {
      setSiweBusy(false);
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      setEmailError((err as Error).message);
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error === "expired" && (
        <p className="badge mb-2 block">That link has expired. Request another below.</p>
      )}

      {/* Sign-In With Ethereum */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={signInWithEthereum}
          disabled={siweBusy}
          className="btn-solid w-full"
        >
          {siweBusy ? "Signing…" : "Sign in with Ethereum"}
        </button>
        {!hasInjected && (
          <MobileWalletHelp />
        )}
        {siweError && <p className="text-sm text-accent">{siweError}</p>}
        <p className="text-xs text-ink-faded text-center italic">
          Wallet-based sign-in. Sign a message with your address. No password, no email, no account.
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs uppercase tracking-smallcaps text-ink-faded">
        <span className="flex-1 border-t border-ink/40" />
        <span>or by post</span>
        <span className="flex-1 border-t border-ink/40" />
      </div>

      {/* Email magic-link */}
      {submitted ? (
        <div className="text-center">
          <p className="font-display text-xl">Check your inbox.</p>
          <p className="mt-2 text-ink-faded">
            We sent a sign-in link to <em>{email}</em>. It expires in 15 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={onEmailSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="reader@example.com"
            />
          </div>
          {emailError && <p className="text-sm text-accent">{emailError}</p>}
          <button type="submit" disabled={emailBusy} className="btn w-full">
            {emailBusy ? "Sending…" : "Send a magic link"}
          </button>
          <p className="text-xs text-ink-faded text-center">
            One-tap link, valid for 15 minutes. No password.
          </p>
        </form>
      )}
    </div>
  );
}

function MobileWalletHelp() {
  // Construct deep links that open this same page inside common wallet browsers.
  // Useful on iOS / Android Safari where window.ethereum is not present.
  const [host, setHost] = useState<string>("");
  useEffect(() => {
    if (typeof window !== "undefined") setHost(`${window.location.host}${window.location.pathname}`);
  }, []);
  if (!host) return null;
  const fullUrl = typeof window !== "undefined" ? window.location.href : "";
  const metamaskUrl = `https://metamask.app.link/dapp/${host}`;
  const coinbaseUrl = `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(fullUrl)}`;
  const trustUrl = `https://link.trustwallet.com/open_url?url=${encodeURIComponent(fullUrl)}`;
  return (
    <div className="text-xs text-ink-faded space-y-2 text-center">
      <p>No wallet detected in this browser. Open this page inside a wallet:</p>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <a href={metamaskUrl}>MetaMask</a>
        <span aria-hidden>·</span>
        <a href={coinbaseUrl}>Coinbase Wallet</a>
        <span aria-hidden>·</span>
        <a href={trustUrl}>Trust</a>
      </p>
    </div>
  );
}
