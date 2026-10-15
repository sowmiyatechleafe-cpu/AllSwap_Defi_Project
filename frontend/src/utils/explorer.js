// Block-explorer links for every supported network.

const EVM_EXPLORERS = {
  1: ["Etherscan", "https://etherscan.io"],
  11155111: ["Sepolia Etherscan", "https://sepolia.etherscan.io"],
  17000: ["Holesky Etherscan", "https://holesky.etherscan.io"],
  10: ["Optimism Etherscan", "https://optimistic.etherscan.io"],
  56: ["BscScan", "https://bscscan.com"],
  137: ["PolygonScan", "https://polygonscan.com"],
  8453: ["BaseScan", "https://basescan.org"],
  42161: ["Arbiscan", "https://arbiscan.io"],
  43114: ["Snowtrace", "https://snowtrace.io"],
};

/**
 * @param chain  "evm" | "solana" | "bitcoin"
 * @param chainId  EVM chain id (number | bigint | string) – ignored otherwise
 * @param kind  "address" | "tx"
 * @returns {{ url: string, name: string } | null}  null when there is no
 *          public explorer (e.g. a local Hardhat node)
 */
export function explorerLink(chain, chainId, kind, value) {
  if (!value) return null;

  if (chain === "solana") {
    return {
      name: "Solscan",
      url: `https://solscan.io/${kind === "tx" ? "tx" : "account"}/${value}`,
    };
  }

  if (chain === "bitcoin") {
    return {
      name: "mempool.space",
      url: `https://mempool.space/${kind === "tx" ? "tx" : "address"}/${value}`,
    };
  }

  const entry = EVM_EXPLORERS[Number(chainId)];
  if (!entry) return null;
  return {
    name: entry[0],
    url: `${entry[1]}/${kind === "tx" ? "tx" : "address"}/${value}`,
  };
}
