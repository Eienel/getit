const EXPLORERS: Record<string, string> = {
  base: "https://basescan.org",
  ethereum: "https://etherscan.io",
  optimism: "https://optimistic.etherscan.io",
  arbitrum: "https://arbiscan.io",
};

export function explorerTxUrl(chain: string, hash: string): string {
  const base = EXPLORERS[chain] ?? "https://basescan.org";
  return `${base}/tx/${hash}`;
}

export function explorerAddressUrl(chain: string, address: string): string {
  const base = EXPLORERS[chain] ?? "https://basescan.org";
  return `${base}/address/${address}`;
}
