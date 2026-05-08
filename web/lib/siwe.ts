// Sign-In With Ethereum (EIP-4361). The minimum we need to:
// 1. issue a fresh nonce to the client (signed token, no DB hit needed),
// 2. accept a (message, signature) pair, parse + validate the EIP-4361 fields,
// 3. verify the signature against the claimed address (EOA + ERC-1271),
// 4. return the recovered address so callers can upsert the user.
//
// We use viem's built-in helpers so we don't take on a separate `siwe` dep.

import { createPublicClient, http, fallback } from "viem";
import { parseSiweMessage, createSiweMessage, type SiweMessage } from "viem/siwe";
import { signToken, verifyToken } from "./crypto";
import { getChain } from "./zerion/chains";

const NONCE_TTL_SEC = 10 * 60; // 10 minutes
const MESSAGE_TTL_SEC = 10 * 60;
const ACCEPTED_CHAIN_IDS = [8453, 1, 10, 42161]; // base, ethereum, optimism, arbitrum

export type SiweNonceToken = string;

export function issueNonce(): { nonce: string; token: SiweNonceToken } {
  // The nonce itself is what gets baked into the SIWE message; the token is
  // a signed bearer that the client posts back so we can verify the nonce
  // came from us (no per-nonce DB row needed).
  const nonce = randomNonce();
  const token = signToken({ kind: "siwe-nonce", nonce }, NONCE_TTL_SEC);
  return { nonce, token };
}

function randomNonce(): string {
  // EIP-4361 recommends 8+ alphanumeric chars; viem requires that.
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // node fallback
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { randomFillSync } = require("node:crypto") as typeof import("node:crypto");
    randomFillSync(bytes);
  }
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function buildSiweStatement(domain: string): string {
  return `Sign in to Bequest. By signing this message you authenticate to ${domain} only. This signature does not authorize any onchain transaction.`;
}

// Build the canonical EIP-4361 message text on the server. The client signs
// the exact bytes we hand them; this avoids "user signed something slightly
// different" mismatches across wallets.
export function buildMessage({
  domain,
  origin,
  address,
  chainId,
  nonce,
}: {
  domain: string;
  origin: string;
  address: `0x${string}`;
  chainId: number;
  nonce: string;
}): string {
  return createSiweMessage({
    domain,
    address,
    statement: buildSiweStatement(domain),
    uri: origin,
    version: "1",
    chainId,
    nonce,
    issuedAt: new Date(),
    expirationTime: new Date(Date.now() + MESSAGE_TTL_SEC * 1000),
  });
}

export type VerifyArgs = {
  message: string;
  signature: `0x${string}`;
  nonceToken: SiweNonceToken;
  expectedDomain: string;
};

export type VerifyResult =
  | { ok: true; address: `0x${string}`; chainId: number }
  | { ok: false; reason: string };

export async function verifySiwe(args: VerifyArgs): Promise<VerifyResult> {
  let parsed: SiweMessage;
  try {
    parsed = parseSiweMessage(args.message) as SiweMessage;
  } catch (e) {
    return { ok: false, reason: `Could not parse SIWE message: ${(e as Error).message}` };
  }

  // Domain check: prevents replay across origins.
  if (!parsed.domain || parsed.domain.toLowerCase() !== args.expectedDomain.toLowerCase()) {
    return { ok: false, reason: `Domain mismatch (expected ${args.expectedDomain}, got ${parsed.domain}).` };
  }

  // Nonce check: must match the one we issued.
  const nonceClaim = verifyToken<{ kind: string; nonce: string }>(args.nonceToken);
  if (!nonceClaim || nonceClaim.kind !== "siwe-nonce" || nonceClaim.nonce !== parsed.nonce) {
    return { ok: false, reason: "Nonce expired or invalid. Refresh and try again." };
  }

  // Time bounds.
  const now = Date.now();
  if (parsed.issuedAt && new Date(parsed.issuedAt).getTime() > now + 60_000) {
    return { ok: false, reason: "issuedAt is in the future." };
  }
  if (parsed.expirationTime && new Date(parsed.expirationTime).getTime() < now) {
    return { ok: false, reason: "Message expired." };
  }
  if (parsed.notBefore && new Date(parsed.notBefore).getTime() > now) {
    return { ok: false, reason: "Message not yet valid (notBefore)." };
  }

  if (!parsed.address) return { ok: false, reason: "Missing address in SIWE message." };
  const chainId = Number(parsed.chainId);
  if (!Number.isFinite(chainId) || !ACCEPTED_CHAIN_IDS.includes(chainId)) {
    return { ok: false, reason: `Chain ${parsed.chainId} not accepted.` };
  }

  // Signature verification: supports EOAs and ERC-1271 smart wallets via
  // a viem public client on the claimed chain.
  const chainKey = chainIdToKey(chainId);
  const chainConfig = getChain(chainKey);
  const client = createPublicClient({
    chain: chainConfig.viem,
    transport:
      chainConfig.rpcs.length > 1
        ? fallback(chainConfig.rpcs.map((u) => http(u)), { rank: false })
        : http(chainConfig.rpcs[0]),
  });

  let valid = false;
  try {
    valid = await client.verifyMessage({
      address: parsed.address,
      message: args.message,
      signature: args.signature,
    });
  } catch (e) {
    return { ok: false, reason: `Signature verification failed: ${(e as Error).message}` };
  }
  if (!valid) return { ok: false, reason: "Invalid signature." };

  return { ok: true, address: parsed.address.toLowerCase() as `0x${string}`, chainId };
}

function chainIdToKey(chainId: number): "base" | "ethereum" | "optimism" | "arbitrum" {
  switch (chainId) {
    case 8453: return "base";
    case 1: return "ethereum";
    case 10: return "optimism";
    case 42161: return "arbitrum";
    default: throw new Error(`Unsupported chainId: ${chainId}`);
  }
}
