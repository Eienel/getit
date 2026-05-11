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

  console.log("TX TO:", tx.to);
  console.log("TX DATA:", tx.data);
  console.log("ALLOWLIST:", allowed);

  let recipient = (tx.to || "").toLowerCase();
  const data = (tx.data || "").toLowerCase();

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

    console.log("DECODED ERC20 RECIPIENT:", recipient);
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
