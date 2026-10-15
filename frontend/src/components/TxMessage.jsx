import { useWallet } from "../context/WalletContext";
import { explorerLink } from "../utils/explorer.js";

/**
 * Shows a success message. When it contains a transaction hash
 * ("Transaction: 0x…") the hash is replaced by one clear button that opens
 * the transaction on the block explorer (Etherscan, Solscan, …).
 */
export default function TxMessage({ text }) {
  const { network, chain } = useWallet();
  const match = /(0x[0-9a-fA-F]{64})/.exec(text || "");
  if (!match) return <>{text}</>;

  const hash = match[1];
  const link = explorerLink(chain || "evm", network?.chainId, "tx", hash);

  // "Swap confirmed. Transaction: 0x…"  ->  "Swap confirmed."
  const lead = text.split(hash)[0].replace(/\s*Transaction:?\s*$/i, "").trim();

  return (
    <span className="tx-success">
      <span>{lead || "Transaction confirmed."}</span>
      {link ? (
        <a
          className="tx-button"
          href={link.url}
          target="_blank"
          rel="noreferrer"
        >
          View on {link.name} ↗
        </a>
      ) : (
        <code className="tx-hash">{hash}</code>
      )}
    </span>
  );
}
