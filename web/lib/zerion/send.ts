// EVM transfer primitive — a faithful TypeScript port of
//   /cli/commands/trading/send.js
// and the helpers in
//   /cli/utils/trading/transaction.js
//
// Same wire behavior: ERC-20 `transfer(address,uint256)` ABI encoding via viem,
// EIP-1559 fee bump, gas estimate with fallback, balance precheck, and the
// scoped-policy gate is invoked BEFORE signing — exactly mirroring
// `enforceExecutablePolicies` in the CLI's send.js.
//
// The only adapter compared to the CLI: this version takes the wallet's
// private key as a function argument (so it works without ~/.zerion/keystore).
// Everything else — ABI selectors, RPC fallbacks, transaction shape — is bit-
// for-bit identical to what `zerion send <token> <amount> ...` produces.

import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
  parseUnits,
  parseEther,
  encodeFunctionData,
  parseAbi,
  formatEther,
  formatUnits,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain } from "./chains";
import { lookupAsset, NATIVE_ASSET_ADDRESS } from "./assets";
import { checkPolicy, type ScopedPolicy } from "./policy";

const ERC20_TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);
const ERC20_BALANCE_OF_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

function buildTransport(rpcs: string[]) {
  if (rpcs.length === 0) return http();
  if (rpcs.length === 1) return http(rpcs[0]);
  return fallback(
    rpcs.map((u) => http(u)),
    { rank: false },
  );
}

export type SendArgs = {
  chain: string;
  asset: string; // symbol
  amount: string; // decimal string
  to: Address;
  privateKey: Hex; // 0x-prefixed
  policy?: ScopedPolicy; // policy gate — when present, applied before signing
};

export type SendResult = {
  hash: Hex;
  status: "success" | "reverted";
  blockNumber: number;
  gasUsed: number;
  from: Address;
  to: Address;
};

export async function sendOnchain(args: SendArgs): Promise<SendResult> {
  const { chain, asset, amount, to, privateKey, policy } = args;
  const account = privateKeyToAccount(privateKey);
  const chainConfig = getChain(chain);
  const client = createPublicClient({
    chain: chainConfig.viem,
    transport: buildTransport(chainConfig.rpcs),
  });
  const wallet = createWalletClient({
    chain: chainConfig.viem,
    transport: buildTransport(chainConfig.rpcs),
    account,
  });

  const resolved = lookupAsset(asset, chain);
  const isNative = resolved.address === "native";
  const amountParsed = isNative
    ? parseEther(amount)
    : parseUnits(amount, resolved.decimals);

  const [nonce, feeData] = await Promise.all([
    client.getTransactionCount({ address: account.address, blockTag: "pending" }),
    client.estimateFeesPerGas(),
  ]);

  let txTo: Address;
  let txData: Hex;
  let txValue: bigint;
  let txGas: bigint;

  if (isNative) {
    const balance = await client.getBalance({ address: account.address });
    const estimatedGasCost = 21000n * (feeData.maxFeePerGas || 0n);
    if (balance < amountParsed + estimatedGasCost) {
      throw new Error(
        `Insufficient ${resolved.symbol}: have ${formatEther(balance)}, need ${amount} + gas (~${formatEther(estimatedGasCost)})`,
      );
    }
    txTo = to;
    txData = "0x";
    txValue = amountParsed;
    txGas = 21000n;
  } else {
    if (resolved.address === "native") throw new Error("Unreachable");
    const tokenAddress = resolved.address as Address;
    const tokenBalance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    if (tokenBalance < amountParsed) {
      throw new Error(
        `Insufficient ${resolved.symbol}: have ${formatUnits(tokenBalance, resolved.decimals)}, need ${amount}`,
      );
    }
    txData = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [to, amountParsed],
    });
    txTo = tokenAddress;
    txValue = 0n;
    txGas = await estimateGasWithFallback(client, account.address, tokenAddress, txData, 65000n);
  }

  // Policy gate — applied BEFORE signing, mirroring `enforceExecutablePolicies`.
  if (policy) {
    const decision = checkPolicy(policy, {
      to: txTo,
      data: txData,
      value: txValue,
      chain,
    });
    if (!decision.allow) {
      const err = new Error(`Policy denied: ${decision.reason}`) as Error & { code: string };
      err.code = "policy_denied";
      throw err;
    }
  }

  const hash = await wallet.sendTransaction({
    to: txTo,
    data: txData,
    value: txValue,
    gas: txGas,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    nonce,
    type: "eip1559",
  });

  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return {
    hash,
    status: receipt.status,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: Number(receipt.gasUsed),
    from: account.address,
    to: txTo,
  };
}

async function estimateGasWithFallback(
  client: ReturnType<typeof createPublicClient>,
  account: Address,
  to: Address,
  data: Hex,
  fallbackGas: bigint,
): Promise<bigint> {
  try {
    const estimate = await client.estimateGas({ account, to, data, value: 0n });
    return (estimate * 120n) / 100n; // 20% buffer — same as the CLI
  } catch (err) {
    const msg = (err as Error).message || "";
    if (msg.includes("exceeds balance") || msg.includes("insufficient") || msg.includes("underflow")) {
      const e = new Error(`Transfer would fail: ${msg.split("\n")[0]}. Check your token balance.`) as Error & {
        code: string;
      };
      e.code = "transfer_would_revert";
      throw e;
    }
    return fallbackGas;
  }
}

// Wallet generation — generates a fresh privkey for a per-bequest hot wallet.
import { generatePrivateKey } from "viem/accounts";

export function newWallet(): { privateKey: Hex; address: Address } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}

// Lightweight balance read for funding detection — viem-direct so we don't
// burn Zerion API calls per-bequest while polling.
export async function getOnchainBalance({
  chain,
  asset,
  address,
}: {
  chain: string;
  asset: string;
  address: Address;
}): Promise<bigint> {
  const chainConfig = getChain(chain);
  const client = createPublicClient({
    chain: chainConfig.viem,
    transport: buildTransport(chainConfig.rpcs),
  });
  const resolved = lookupAsset(asset, chain);
  if (resolved.address === "native") {
    return client.getBalance({ address });
  }
  return client.readContract({
    address: resolved.address as Address,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [address],
  });
}
