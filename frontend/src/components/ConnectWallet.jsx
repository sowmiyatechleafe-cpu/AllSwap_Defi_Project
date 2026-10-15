import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "../context/WalletContext";
import { explorerLink } from "../utils/explorer.js";

const CHAINS = [
  { key: "evm", label: "EVM", hint: "Ethereum, Base, Polygon, BNB…" },
  { key: "solana", label: "Solana", hint: "Phantom, Solflare, Backpack…" },
  { key: "bitcoin", label: "Bitcoin", hint: "UniSat, Xverse, Leather…" },
];

const INSTALL = {
  evm: [
    ["MetaMask", "https://metamask.io/download/"],
    ["Rabby", "https://rabby.io/"],
    ["Coinbase Wallet", "https://www.coinbase.com/wallet"],
  ],
  solana: [
    ["Phantom", "https://phantom.com/download"],
    ["Solflare", "https://solflare.com/download"],
    ["Backpack", "https://backpack.app/downloads"],
  ],
  bitcoin: [
    ["UniSat", "https://unisat.io/download"],
    ["Xverse", "https://www.xverse.app/download"],
    ["Leather", "https://leather.io/install-extension"],
  ],
};

const shortenAddress = (address) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";

function WalletModal() {
  const { wallets, modalOpen, closeWalletModal, connectWallet, connecting, error } =
    useWallet();
  const [tab, setTab] = useState("evm");
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!modalOpen) return;
    // open on the first network that has an installed wallet
    const first = CHAINS.find((c) => wallets[c.key]?.length);
    if (first) setTab(first.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e) => e.key === "Escape" && closeWalletModal();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeWalletModal]);

  if (!modalOpen) return null;

  const list = wallets[tab] || [];

  const pick = async (w) => {
    setPending(w.id);
    await connectWallet(w);
    setPending(null);
  };

  return createPortal(
    <div className="wallet-modal-overlay" onClick={closeWalletModal}>
      <div
        className="wallet-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Connect a wallet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wallet-modal-head">
          <h3>Connect a wallet</h3>
          <button
            type="button"
            className="wallet-modal-close"
            onClick={closeWalletModal}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="wallet-tabs" role="tablist">
          {CHAINS.map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={tab === c.key}
              className={`wallet-tab ${tab === c.key ? "active" : ""}`}
              onClick={() => setTab(c.key)}
            >
              {c.label}
              <span className="wallet-tab-count">{wallets[c.key]?.length || 0}</span>
            </button>
          ))}
        </div>

        {list.length > 0 ? (
          <ul className="wallet-list">
            {list.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className="wallet-option"
                  disabled={connecting}
                  onClick={() => pick(w)}
                >
                  <img src={w.icon} alt="" width="32" height="32" />
                  <span className="wallet-option-name">{w.name}</span>
                  <span className="wallet-option-state">
                    {pending === w.id && connecting ? "Check wallet…" : "Detected"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="wallet-none">
            <p>
              No {CHAINS.find((c) => c.key === tab).label} wallet extension found in
              this browser.
            </p>
            <div className="wallet-install">
              {INSTALL[tab].map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer">
                  Get {name}
                </a>
              ))}
            </div>
          </div>
        )}

        {error && <div className="wallet-modal-error">{error}</div>}

        <p className="wallet-modal-foot">
          {CHAINS.find((c) => c.key === tab).hint}. You can have several wallet
          extensions installed — pick the one you want to use.
        </p>
      </div>
    </div>,
    document.body
  );
}

export default function ConnectWallet() {
  const {
    account,
    balance,
    nativeSymbol,
    network,
    chain,
    activeWallet,
    connecting,
    error,
    openWalletModal,
    disconnectWallet,
    modalOpen,
  } = useWallet();

  /* Wallet not connected */
  if (!account) {
    return (
      <div className="connect-wrapper">
        <button
          className="connect-button"
          onClick={openWalletModal}
          disabled={connecting}
        >
          {connecting ? "Connecting..." : "Connect Wallet"}
        </button>

        {error && !modalOpen && <div className="wallet-error">{error}</div>}

        <WalletModal />
      </div>
    );
  }

  /* Wallet connected */
  return (
    <div className="wallet-wrapper">
      <div className="wallet-name" title={activeWallet?.name}>
        {activeWallet?.icon && (
          <img src={activeWallet.icon} alt="" width="18" height="18" />
        )}
        {activeWallet?.name}
      </div>

      {(() => {
        const link = explorerLink(chain, network?.chainId, "address", account);
        return link ? (
          <a
            className="wallet-address wallet-address-link"
            href={link.url}
            target="_blank"
            rel="noreferrer"
            title={`View transaction history on ${link.name}`}
          >
            {shortenAddress(account)} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <div className="wallet-address" title={account}>
            {shortenAddress(account)}
          </div>
        );
      })()}

      <div className="wallet-balance">
        {balance == null
          ? `— ${nativeSymbol}`
          : `${Number(balance).toFixed(4)} ${nativeSymbol}`}
      </div>

      <div className="wallet-network">{network?.name || "Unknown"}</div>

      <button className="disconnect-button" onClick={disconnectWallet}>
        Disconnect
      </button>
    </div>
  );
}
