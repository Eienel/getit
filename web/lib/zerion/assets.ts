// Asset registry. For the hackathon we pin a small allowlist of well-known
// assets per chain. The full Zerion CLI resolves these dynamically via
// /cli/utils/trading/resolve-token.js + /v1/fungibles/<id>/. That path stays
// available to extend (see resolveTokenViaZerion below).

import { fetchZerion } from "./api";

export type Asset = {
  symbol: string;
  chain: string;
  address: `0x${string}` | "native";
  decimals: number;
  display: string;
};

export const NATIVE_ASSET_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const REGISTRY: Asset[] = [
  // Base
  { symbol: "USDC", chain: "base", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6, display: "USDC" },
  { symbol: "ETH", chain: "base", address: "native", decimals: 18, display: "ETH" },
  { symbol: "WETH", chain: "base", address: "0x4200000000000000000000000000000000000006", decimals: 18, display: "WETH" },
  // Base Sepolia (testnet). Circle's official test USDC + native test ETH.
  // Faucets: https://portal.cdp.coinbase.com/products/faucet (ETH),
  //          https://faucet.circle.com/                       (USDC).
  { symbol: "USDC", chain: "base-sepolia", address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e", decimals: 6, display: "USDC" },
  { symbol: "ETH", chain: "base-sepolia", address: "native", decimals: 18, display: "ETH" },
  // Ethereum
  { symbol: "USDC", chain: "ethereum", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6, display: "USDC" },
  { symbol: "ETH", chain: "ethereum", address: "native", decimals: 18, display: "ETH" },
  // Optimism
  { symbol: "USDC", chain: "optimism", address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", decimals: 6, display: "USDC" },
  { symbol: "ETH", chain: "optimism", address: "native", decimals: 18, display: "ETH" },
  // Arbitrum
  { symbol: "USDC", chain: "arbitrum", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6, display: "USDC" },
  { symbol: "ETH", chain: "arbitrum", address: "native", decimals: 18, display: "ETH" },
];

export function lookupAsset(symbol: string, chain: string): Asset {
  const asset = REGISTRY.find(
    (a) => a.symbol.toUpperCase() === symbol.toUpperCase() && a.chain === chain,
  );
  if (!asset) throw new Error(`Unsupported asset: ${symbol} on ${chain}`);
  return asset;
}

export function listAssetsForChain(chain: string): Asset[] {
  return REGISTRY.filter((a) => a.chain === chain);
}

export function listChains(): string[] {
  return Array.from(new Set(REGISTRY.map((a) => a.chain)));
}

// Optional: fall back to Zerion's fungibles API for tokens not in the registry.
// Not used in the MVP demo flow but kept here as the Zerion-CLI lineage for
// dynamic token resolution (mirrors /cli/utils/trading/resolve-token.js).
export async function resolveTokenViaZerion(symbol: string, chain: string) {
  return fetchZerion(`/fungibles?filter[search_query]=${encodeURIComponent(symbol)}&filter[implementation_chain_id]=${chain}`);
}
