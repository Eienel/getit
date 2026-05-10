#!/usr/bin/env node
/**
 * Executable policy: only allow transactions to known contract addresses.
 * The allowed addresses are passed in policy_config.allowed_addresses.
 */

import { fileURLToPath } from "node:url";
import { runPolicyFromStdin } from "../utils/common/prompt.js";

export function check(ctx) {
  const tx = ctx.transaction || {};
  const config = ctx.policy_config || {};

  const allowed = (config.allowed_addresses || []).map((a) =>
    a.toLowerCase(),
  );

  // If no allowlist is set, allow everything
  if (allowed.length === 0) {
    return { allow: true };
  }

  let recipient = (tx.to || "").toLowerCase();
  const data = (tx.data || "").toLowerCase();

  // ERC20 transfer(address,uint256)
  const TRANSFER_SELECTOR = "0xa9059cbb";

  const isERC20Transfer =
    data &&
    data.startsWith(TRANSFER_SELECTOR) &&
    data.length >= 138;

  if (isERC20Transfer) {
    const encodedRecipient = data.slice(10, 74);

    recipient =
      "0x" +
      encodedRecipient
        .slice(24)
        .toLowerCase();
  }

  if (!recipient || recipient === "0x") {
    return {
      allow: false,
      reason: "Transaction has no valid recipient address.",
    };
  }

  if (allowed.includes(recipient)) {
    return { allow: true };
  }

  return {
    allow: false,
    reason: `Recipient ${recipient} is not in the allowlist.`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPolicyFromStdin(check);
}
