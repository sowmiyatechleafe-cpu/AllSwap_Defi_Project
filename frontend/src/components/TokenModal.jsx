import TxMessage from "./TxMessage.jsx";
import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";

import { useWallet } from "../context/WalletContext.jsx";
import { usePrices, formatUsd } from "../context/PriceContext.jsx";
import { TOKENS, label } from "../data/tokens.js";
import {
  TOKEN_CONFIG,
  executeTokenSwap,
  getSwapQuote,
  sendToken,
} from "../contracts/contract.js";
import TokenIcon from "./TokenIcon.jsx";

const SWAPPABLE = ["PILOT", "USDC"];

const fmt = (value, max = 6) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: max });

const short = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <button type="button" className="tm-copy" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/* ---------------------------- SEND ---------------------------- */
function SendPanel({ token, balance, price, onDone }) {
  const { account, signer, network } = useWallet();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const toValid = ethers.isAddress(to.trim());
  const showToError = to.trim().length > 0 && !toValid;
  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const tooMuch = amountValid && balance != null && amountNum > Number(balance);

  let buttonText = `Send ${label(token)}`;
  let disabled = false;
  if (!to.trim()) { buttonText = "Enter recipient address"; disabled = true; }
  else if (!toValid) { buttonText = "Recipient is not a valid address"; disabled = true; }
  else if (!amountValid) { buttonText = "Enter an amount"; disabled = true; }
  else if (tooMuch) { buttonText = `Insufficient ${label(token)} balance`; disabled = true; }

  async function handleSend() {
    setError("");
    setMessage("");
    if (!signer) { setError("Connect an EVM wallet first."); return; }

    try {
      setBusy(true);
      let receipt;

      if (token.type === "native") {
        const tx = await signer.sendTransaction({
          to: to.trim(),
          value: ethers.parseEther(amount),
        });
        receipt = await tx.wait();
      } else {
        receipt = await sendToken(signer, token.symbol, to.trim(), amount);
      }

      setMessage(
        receipt?.hash ? `Sent. Transaction: ${receipt.hash}` : "Transfer completed."
      );
      setAmount("");
      setTo("");
      onDone();
    } catch (err) {
      setError(
        err?.shortMessage || err?.reason || err?.message || "Transfer failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tm-panel">
      <label className="tm-label">From address</label>
      <div className="tm-field tm-address">
        <span>{account}</span>
        <CopyButton text={account || ""} />
      </div>

      <label className="tm-label" htmlFor="tm-to">To address</label>
      <input
        id="tm-to"
        className={`tm-input tm-mono ${showToError ? "tm-input-error" : ""}`}
        placeholder="0x..."
        value={to}
        onChange={(e) => setTo(e.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
      {showToError && (
        <p className="tm-error-text">
          Not a valid {network?.name && network.name !== "unknown" ? network.name : "Sepolia"} address.
        </p>
      )}

      <label className="tm-label">Token</label>
      <div className="tm-field tm-token-row">
        <span className="tm-token-chip">
          <TokenIcon token={token} size={24} />
          {label(token)}
        </span>
        <span className="tm-balance-right">
          Balance
          <strong>{balance != null ? `${fmt(balance)} ${label(token)}` : "—"}</strong>
        </span>
      </div>

      <label className="tm-label" htmlFor="tm-amount">Amount</label>
      <div className="tm-input-wrap">
        <input
          id="tm-amount"
          className="tm-input tm-input-lg"
          type="number"
          min="0"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          type="button"
          className="tm-max"
          onClick={() => balance != null && setAmount(String(balance))}
        >
          MAX
        </button>
        <span className="tm-unit">{label(token)}</span>
      </div>
      {price && amountValid && (
        <small className="tm-hint">≈ {formatUsd(amountNum * price.usd)}</small>
      )}

      {error && <p className="tm-banner tm-banner-error">{error}</p>}
      {message && <p className="tm-banner tm-banner-ok"><TxMessage text={message} /></p>}

      <button
        type="button"
        className="tm-primary"
        disabled={disabled || busy}
        onClick={handleSend}
      >
        {busy ? "Confirm in your wallet…" : buttonText}
      </button>
    </div>
  );
}

/* --------------------------- RECEIVE -------------------------- */
function ReceivePanel({ token }) {
  const { account, network } = useWallet();
  const contract = TOKEN_CONFIG[token.symbol]?.address;
  const hasContract = token.type !== "native" && ethers.isAddress(contract || "");
  const netName =
    network?.name && network.name !== "unknown" ? network.name : "Sepolia";

  return (
    <div className="tm-panel tm-center">
      <h4>Receive {label(token)}</h4>
      <p className="tm-sub">
        Scan or share this address to get {label(token)} on {netName}.
      </p>

      <div className="tm-qr">
        <QRCodeSVG value={account || ""} size={168} level="M" fgColor="#0b1b30" bgColor="#ffffff" />
      </div>

      <div className="tm-box">
        <small>Your {label(token)} address</small>
        <div className="tm-address">
          <span>{account}</span>
          <CopyButton text={account || ""} />
        </div>
      </div>

      {hasContract && (
        <div className="tm-box">
          <small>{label(token)} token contract</small>
          <div className="tm-address">
            <a
              href={`https://sepolia.etherscan.io/token/${contract}`}
              target="_blank"
              rel="noreferrer"
            >
              {short(contract)}
            </a>
            <CopyButton text={contract} />
          </div>
          <p className="tm-note">
            Import this contract in your wallet if {label(token)} does not show
            up after you receive it.
          </p>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- SWAP --------------------------- */
function SwapPanel({ token, balances, getPrice, onDone }) {
  const { provider, signer } = useWallet();

  const [from, setFrom] = useState(token);
  const [to, setTo] = useState(
    token.symbol === "USDC"
      ? TOKENS.find((t) => t.symbol === "PILOT")
      : TOKENS.find((t) => t.symbol === "USDC")
  );
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const supported =
    SWAPPABLE.includes(from.symbol) &&
    SWAPPABLE.includes(to.symbol) &&
    from.symbol !== to.symbol;

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const fromBal = balances[from.symbol]?.balance;
  const toBal = balances[to.symbol]?.balance;

  useEffect(() => {
    let cancelled = false;
    setQuote("");
    if (!amountValid || !supported || !provider) return;

    getSwapQuote(provider, from.symbol, amount)
      .then((q) => !cancelled && setQuote(String(q)))
      .catch((err) => !cancelled && setError(err?.shortMessage || err?.message || "Quote failed."));

    return () => { cancelled = true; };
  }, [provider, from, amount, amountValid, supported]);

  function pick(side, symbol) {
    const next = TOKENS.find((t) => t.symbol === symbol);
    setError(""); setMessage(""); setAmount(""); setQuote("");
    if (side === "from") {
      if (next.symbol === to.symbol) setTo(from);
      setFrom(next);
    } else {
      if (next.symbol === from.symbol) setFrom(to);
      setTo(next);
    }
  }

  function flip() {
    setFrom(to); setTo(from); setAmount(""); setQuote(""); setError(""); setMessage("");
  }

  let buttonText = "Swap";
  let disabled = false;
  if (!supported) { buttonText = "Only PILOT ⇄ USDC swaps are supported"; disabled = true; }
  else if (!amountValid) { buttonText = "Enter an amount"; disabled = true; }
  else if (fromBal != null && amountNum > Number(fromBal)) { buttonText = `Insufficient ${label(from)} balance`; disabled = true; }

  async function handleSwap() {
    setError(""); setMessage("");
    if (!signer) { setError("Connect an EVM wallet first."); return; }
    try {
      setBusy(true);
      const receipt = await executeTokenSwap(signer, from.symbol, amount);
      setMessage(receipt?.hash ? `Swap confirmed. Transaction: ${receipt.hash}` : "Swap completed.");
      setAmount(""); setQuote("");
      onDone();
    } catch (err) {
      setError(err?.shortMessage || err?.reason || err?.message || "Swap failed.");
    } finally {
      setBusy(false);
    }
  }

  const select = (side, current) => (
    <select
      className="tm-select"
      value={current.symbol}
      onChange={(e) => pick(side, e.target.value)}
    >
      {TOKENS.map((t) => (
        <option key={t.symbol} value={t.symbol}>{label(t)}</option>
      ))}
    </select>
  );

  const fromPrice = getPrice(from);

  return (
    <div className="tm-panel">
      <div className="tm-swap-title">
        <strong>Swap {label(token)}</strong>
      </div>

      <div className="tm-swap-box">
        <div className="tm-swap-top">
          <span>From</span>
          <span>Balance: {fromBal != null ? fmt(fromBal, 4) : "—"}</span>
        </div>
        <div className="tm-swap-row">
          <input
            type="number" min="0" placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button type="button" className="tm-max" onClick={() => fromBal != null && setAmount(String(fromBal))}>MAX</button>
          {select("from", from)}
        </div>
        {fromPrice && amountValid && (
          <small className="tm-hint">≈ {formatUsd(amountNum * fromPrice.usd)}</small>
        )}
      </div>

      <button type="button" className="tm-flip" onClick={flip} aria-label="Switch tokens">⇅</button>

      <div className="tm-swap-box">
        <div className="tm-swap-top">
          <span>To (estimated)</span>
          <span>Balance: {toBal != null ? fmt(toBal, 4) : "—"}</span>
        </div>
        <div className="tm-swap-row">
          <input readOnly placeholder="0.0" value={quote ? fmt(quote, 6) : ""} />
          {select("to", to)}
        </div>
      </div>

      {error && <p className="tm-banner tm-banner-error">{error}</p>}
      {message && <p className="tm-banner tm-banner-ok"><TxMessage text={message} /></p>}

      <button type="button" className="tm-primary" disabled={disabled || busy} onClick={handleSwap}>
        {busy ? "Confirm in your wallet…" : buttonText}
      </button>
    </div>
  );
}

/* ----------------------------- MODAL -------------------------- */
export default function TokenModal({ token, balances, onClose, onRefresh, initialTab = "send" }) {
  const { account, network } = useWallet();
  const { getPrice } = usePrices();
  const [tab, setTab] = useState(initialTab);

  const entry = balances[token.symbol];
  const balance = entry?.configured && entry.balance != null ? entry.balance : null;
  const price = getPrice(token);
  const netName =
    network?.name && network.name !== "unknown" ? network.name : "Sepolia";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const tabs = useMemo(
    () => [
      { id: "send", icon: "↑", text: "Send" },
      { id: "receive", icon: "↓", text: "Receive" },
      { id: "swap", icon: "⇄", text: "Swap" },
    ],
    []
  );

  return (
    <div className="tm-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tm-modal" role="dialog" aria-modal="true" aria-label={`${token.name} actions`}>
        <div className="tm-header">
          <TokenIcon token={token} size={44} />
          <div className="tm-title">
            <h3>{label(token)}</h3>
            <span>{token.name} · {netName}</span>
          </div>
          <button type="button" className="tm-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="tm-balance">
          <small>YOUR BALANCE</small>
          <strong>
            {balance != null ? `${fmt(balance)} ${label(token)}` : `— ${label(token)}`}
          </strong>
          <span>
            {balance != null && price ? `≈ ${formatUsd(Number(balance) * price.usd)}` : "\u00A0"}
          </span>
        </div>

        <div className="tm-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tm-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span>
              {t.text}
            </button>
          ))}
        </div>

        {!account ? (
          <p className="tm-banner tm-banner-error">Connect an EVM wallet to continue.</p>
        ) : tab === "send" ? (
          <SendPanel token={token} balance={balance} price={price} onDone={onRefresh} />
        ) : tab === "receive" ? (
          <ReceivePanel token={token} />
        ) : (
          <SwapPanel token={token} balances={balances} getPrice={getPrice} onDone={onRefresh} />
        )}
      </div>
    </div>
  );
}
