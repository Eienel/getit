import { eq, and } from "drizzle-orm";
import { db, schema } from "../db";
import { encrypt, randomToken } from "../crypto";
import { buildPolicy } from "../zerion/policy";
import { getOnchainBalance, sendOnchain } from "../zerion/send";
import { lookupAsset } from "../zerion/assets";
import { parseUnits, parseEther, type Address, type Hex } from "viem";
import { decrypt } from "../crypto";

// Policy time-to-live (must outlast the longest checkin window). 30 days is
// the hackathon backstop — production would extend this.
const POLICY_TTL_DAYS = 30;

// Check whether the per-bequest wallet has been funded with the bequest amount.
// If yes, mint the scoped policy + agent token and flip status to ARMED.
export async function maybeArmBequest(bequestId: string): Promise<{ armed: boolean; balance: string; required: string }> {
  const rows = await db
    .select()
    .from(schema.bequests)
    .where(eq(schema.bequests.id, bequestId))
    .limit(1);
  const b = rows[0];
  if (!b) throw new Error("Bequest not found");
  if (b.status !== "draft") {
    return { armed: b.status !== "draft", balance: "n/a", required: "n/a" };
  }

  const asset = lookupAsset(b.assetSymbol, b.assetChain);
  const required = asset.address === "native"
    ? parseEther(b.amountDecimal)
    : parseUnits(b.amountDecimal, asset.decimals);

  const balance = await getOnchainBalance({
    chain: b.assetChain,
    asset: b.assetSymbol,
    address: b.walletAddress as Address,
  });

  if (balance < required) {
    return { armed: false, balance: balance.toString(), required: required.toString() };
  }

  // Build policy + a synthetic agent-token-id (the equivalent of running
  // `zerion agent create-policy && zerion agent create-token`). The
  // "token" here is a short opaque identifier tied to the policy in our DB.
  const policy = buildPolicy({
    name: `bq-${bequestId}`,
    chain: b.assetChain,
    beneficiary: b.beneficiaryAddress,
    ttlDays: POLICY_TTL_DAYS,
  });
  const agentTokenId = randomToken(16);
  const tokenEnc = encrypt(agentTokenId, `agent-token:${bequestId}`);

  await db
    .update(schema.bequests)
    .set({
      status: "armed",
      policyJson: JSON.stringify(policy),
      agentTokenCiphertext: tokenEnc.ciphertext,
      agentTokenNonce: tokenEnc.nonce,
      lastPingAt: new Date(),
      armedAt: new Date(),
    })
    .where(and(eq(schema.bequests.id, bequestId), eq(schema.bequests.status, "draft")));

  return { armed: true, balance: balance.toString(), required: required.toString() };
}

export async function loadPrivateKey(bequestId: string): Promise<Hex> {
  const rows = await db
    .select({ ct: schema.bequests.walletKeyCiphertext, nonce: schema.bequests.walletKeyNonce })
    .from(schema.bequests)
    .where(eq(schema.bequests.id, bequestId))
    .limit(1);
  if (!rows[0]) throw new Error("Bequest not found");
  const pk = decrypt(rows[0].ct, rows[0].nonce, `wallet:${bequestId}`);
  return pk as Hex;
}

// Used internally for sweep/cancel — the privkey can move funds anywhere,
// bypassing the agent token's allowlist; this is intentional, owners must be
// able to recover funds. We never call this from cron — only from explicit
// user-cancel actions.
export async function sweepToOwner({
  bequestId,
  toAddress,
}: {
  bequestId: string;
  toAddress: Address;
}) {
  const rows = await db
    .select()
    .from(schema.bequests)
    .where(eq(schema.bequests.id, bequestId))
    .limit(1);
  const b = rows[0];
  if (!b) throw new Error("Bequest not found");

  const pk = await loadPrivateKey(bequestId);
  const result = await sendOnchain({
    chain: b.assetChain,
    asset: b.assetSymbol,
    amount: b.amountDecimal,
    to: toAddress,
    privateKey: pk,
    // No policy for owner-sweep (intentional — owner recovery path)
  });
  return result;
}
