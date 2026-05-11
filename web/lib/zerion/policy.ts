// Policy gate — a faithful TypeScript port of the executable policies in the
// forked Zerion CLI:
//   /cli/policies/allowlist.mjs       → allowlist of recipient addresses
//   /cli/policies/deny-approvals.mjs  → ERC-20 approve()/increaseAllowance() blocked
//   /cli/policies/run-policies.mjs    → AND-semantics dispatcher
// Also enforces chain lock + expiry, mirroring the rules supported by
//   /cli/commands/agent/create-policy.js
//
// We deliberately do NOT port deny-transfers.mjs — we WANT transfers; that's
// the whole point of the agent. Security comes from `allowlist` + `chains` +
// `denyApprovals` (and our caller never invokes a swap path).

const ERC20_BLOCKED_SELECTORS = ["0x095ea7b3", "0x39509351"]; // approve, increaseAllowance
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

export type ScopedPolicy = {
  name: string;
  chain: string; // e.g. "base"
  expiresAt: string; // ISO timestamp
  allowedAddresses: string[]; // lowercase 0x...
  denyApprovals: boolean;
};

export type TxContext = {
  to: string;
  data: string;
  value: bigint | string;
  chain: string;
};

export type PolicyDecision = { allow: true } | { allow: false; reason: string };

export function checkPolicy(policy: ScopedPolicy, tx: TxContext): PolicyDecision {
  // Chain lock
  if (tx.chain !== policy.chain) {
    return {
      allow: false,
      reason: `Chain ${tx.chain} not permitted by policy (locked to ${policy.chain}).`,
    };
  }

  // Expiry
  if (new Date() > new Date(policy.expiresAt)) {
    return { allow: false, reason: `Policy expired at ${policy.expiresAt}.` };
  }

  // Allowlist (recipient lock) — this is the core trust commitment
  let to = (tx.to || "").toLowerCase();
  const data = (tx.data || "").toLowerCase();

  // For ERC-20 transfer(address,uint256), tx.to is the token contract and the
  // actual recipient is encoded in calldata (bytes 4..36). Decode it so the
  // allowlist can be scoped to the beneficiary wallet rather than token
  // contracts.
  const isErc20Transfer = data.startsWith(ERC20_TRANSFER_SELECTOR) && data.length >= 138;
  if (isErc20Transfer) {
    const encodedRecipient = data.slice(10, 74);
    to = `0x${encodedRecipient.slice(24)}`;
  }

  const allowed = policy.allowedAddresses.map((a) => a.toLowerCase());
  if (allowed.length > 0) {
    if (!to) return { allow: false, reason: "Transaction has no recipient address." };
    if (!allowed.includes(to)) {
      return {
        allow: false,
        reason: `Recipient ${to} is not in the allowlist.`,
      };
    }
  }

  // Deny approvals
  if (policy.denyApprovals) {
    const selector = data.slice(0, 10);
    if (ERC20_BLOCKED_SELECTORS.includes(selector)) {
      return {
        allow: false,
        reason: `ERC-20 approval calls are blocked by policy (selector: ${selector}).`,
      };
    }
  }

  return { allow: true };
}

export function buildPolicy({
  name,
  chain,
  beneficiary,
  ttlDays,
}: {
  name: string;
  chain: string;
  beneficiary: string;
  ttlDays: number;
}): ScopedPolicy {
  return {
    name,
    chain,
    expiresAt: new Date(Date.now() + ttlDays * 86400_000).toISOString(),
    allowedAddresses: [beneficiary.toLowerCase()],
    denyApprovals: true,
  };
}
