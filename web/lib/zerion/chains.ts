// Hard-coded chain configs for the demo. The full Zerion CLI fetches these
// from the API catalog at /cli/utils/chain/catalog.js. For the hackathon we
// pin a small set of chains so the demo is fast and doesn't depend on catalog
// resolution. Easy to extend.

import { base, baseSepolia, mainnet, optimism, arbitrum } from "viem/chains";
import type { Chain } from "viem";

export type ChainKey = "base" | "base-sepolia" | "ethereum" | "optimism" | "arbitrum";

export const CHAINS: Record<ChainKey, { viem: Chain; rpcs: string[] }> = {
  base: {
    viem: base,
    rpcs: [
      "https://mainnet.base.org",
      "https://base-rpc.publicnode.com",
      "https://base.llamarpc.com",
    ],
  },
  "base-sepolia": {
    viem: baseSepolia,
    rpcs: [
      "https://sepolia.base.org",
      "https://base-sepolia-rpc.publicnode.com",
    ],
  },
  ethereum: {
    viem: mainnet,
    rpcs: ["https://eth.llamarpc.com", "https://ethereum-rpc.publicnode.com"],
  },
  optimism: {
    viem: optimism,
    rpcs: ["https://mainnet.optimism.io", "https://optimism.llamarpc.com"],
  },
  arbitrum: {
    viem: arbitrum,
    rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.llamarpc.com"],
  },
};

export function getChain(key: string): { viem: Chain; rpcs: string[] } {
  const c = CHAINS[key as ChainKey];
  if (!c) throw new Error(`Unsupported chain: ${key}`);
  return c;
}

export function isTestnet(key: string): boolean {
  return key === "base-sepolia";
}
