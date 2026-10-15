 
import TxMessage from "./TxMessage.jsx";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { usePrices, formatUsd } from "../context/PriceContext.jsx";
import { TOKENS, label } from "../data/tokens.js";
import TokenIcon from "./TokenIcon.jsx";
import {
  fundSwapPool,
  executeTokenSwap,
  getSwapQuote,
} from "../contracts/contract.js";

const tokens = TOKENS;

function SwapCard() {
  const { provider, signer, account, chain, nativeSymbol } = useWallet();
  const { getPrice } = usePrices();

  const [payToken, setPayToken] = useState(tokens[0]);
  const [receiveToken, setReceiveToken] = useState(tokens[1]);

  const [payAmount, setPayAmount] = useState("");
  const [receiveAmount, setReceiveAmount] = useState("");

  const [selecting, setSelecting] = useState(null);
  const [tokenSearch, setTokenSearch] = useState("");

  const [loadingQuote, setLoadingQuote] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // Hash of the last confirmed swap. Kept separate from `message` because the
  // quote effect clears `message` whenever the amount box is emptied.
  const [txHash, setTxHash] = useState("");
  const [liquidity, setLiquidity] = useState(null);
  const [funding, setFunding] = useState(false);

  // "≈ $x.xx" for an amount of a given token, using the live price.
  function usdValue(token, amount) {
    const price = getPrice(token);
    const n = Number(amount);

    if (!price || !Number.isFinite(n) || n <= 0) {
      return price ? formatUsd(price.usd) + " per token" : "";
    }

    return `≈ ${formatUsd(n * price.usd)}`;
  }

  // Only the existing PILOT/USDC pair is supported by AllSwap.
  const supportedPair = useMemo(() => {
    const validTokens = ["PILOT", "USDC"];

    return (
      validTokens.includes(payToken.symbol) &&
      validTokens.includes(receiveToken.symbol) &&
      payToken.symbol !== receiveToken.symbol
    );
  }, [payToken, receiveToken]);

  // Search tokens by symbol or name.
  const filteredTokens = useMemo(() => {
    const search = tokenSearch.trim().toLowerCase();

    return tokens.filter((token) => {
      const displaySymbol = (
        token.displaySymbol || token.symbol
      ).toLowerCase();

      return (
        token.symbol.toLowerCase().includes(search) ||
        displaySymbol.includes(search) ||
        token.name.toLowerCase().includes(search)
      );
    });
  }, [tokenSearch]);

  // Load a quote for supported pairs only.
  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      setError("");
      setMessage("");
      setReceiveAmount("");

      if (
        !payAmount ||
        !Number.isFinite(Number(payAmount)) ||
        Number(payAmount) <= 0 ||
        !supportedPair
      ) {
        setLoadingQuote(false);
        return;
      }

      if (!provider) {
        setError("Connect your wallet to get a quote.");
        setLoadingQuote(false);
        return;
      }

      try {
        setLoadingQuote(true);

        const quote = await getSwapQuote(
          provider,
          payToken.symbol,
          payAmount
        );

        if (!cancelled) {
          setReceiveAmount(String(quote));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.shortMessage ||
              err?.message ||
              "Could not get swap quote."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingQuote(false);
        }
      }
    }

    loadQuote();

    return () => {
      cancelled = true;
    };
  }, [
    provider,
    payToken,
    receiveToken,
    payAmount,
    supportedPair,
  ]);

  // Select a token in the modal.
  function chooseToken(token) {
    if (!selecting) return;

    if (selecting === "pay") {
      if (token.symbol === receiveToken.symbol) {
        setReceiveToken(payToken);
      }

      setPayToken(token);
    } else {
      if (token.symbol === payToken.symbol) {
        setPayToken(receiveToken);
      }

      setReceiveToken(token);
    }

    setSelecting(null);
    setTokenSearch("");
    setPayAmount("");
    setReceiveAmount("");
    setError("");
    setMessage("");
    setTxHash("");
  }

  // Reverse the pay and receive tokens.
  function switchTokens() {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
    setPayAmount("");
    setReceiveAmount("");
    setError("");
    setMessage("");
  }

  // Execute the existing smart-contract swap.
  async function handleFundPool() {
    if (!liquidity || !signer) return;
    setError("");
    setMessage("");
    try {
      setFunding(true);
      const { receipt, amount } = await fundSwapPool(
        signer,
        liquidity.symbol,
        liquidity.needed
      );
      setLiquidity(null);
      setMessage(
        `Added ${amount} ${liquidity.symbol} to the swap pool. Transaction: ${receipt.hash}. You can swap now.`
      );
    } catch (err) {
      setError(err?.message || "Could not add liquidity.");
    } finally {
      setFunding(false);
    }
  }

  async function handleSwap() {
    setError("");
    setMessage("");
    setTxHash("");
    setLiquidity(null);

    if (!account || !signer) {
      setError("Please connect a wallet first.");
      return;
    }

    if (!supportedPair) {
      setError(
        "Currently, only PILOT and USDC swaps are supported."
      );
      return;
    }

    if (
      !payAmount ||
      !Number.isFinite(Number(payAmount)) ||
      Number(payAmount) <= 0
    ) {
      setError("Enter a valid amount.");
      return;
    }

    try {
      setSwapping(true);

      const receipt = await executeTokenSwap(
        signer,
        payToken.symbol,
        payAmount
      );

      setTxHash(receipt?.hash || receipt?.transactionHash || "");
      setMessage(receipt?.hash ? "" : "Swap transaction completed.");

      setPayAmount("");
      setReceiveAmount("");
    } catch (err) {
      if (err?.liquidity) setLiquidity(err.liquidity);
      setError(
        err?.shortMessage ||
          err?.reason ||
          err?.message ||
          "Swap failed. Check your wallet and your contract configuration."
      );
    } finally {
      setSwapping(false);
    }
  }

  function closeTokenModal() {
    setSelecting(null);
    setTokenSearch("");
  }

  return (
    <section className="swap-card">
      <div className="swap-card-header">
        <div>
          <h2>Swap Tokens</h2>
          <p>Trade tokens through AllSwap</p>
        </div>

        <img
          className="swap-card-icon"
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
        />
      </div>

      {/* YOU PAY */}
      <div className="token-box">
        <div className="token-box-top">
          <label htmlFor="pay-amount">You pay</label>
          <span>From</span>
        </div>

        <div className="token-input-row">
          <input
            id="pay-amount"
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={payAmount}
            onChange={(event) => {
              setPayAmount(event.target.value);
              setTxHash("");
              setError("");
              setMessage("");
            }}
          />

          <button
            type="button"
            className="token-selector"
            onClick={() => {
              setSelecting("pay");
              setTokenSearch("");
            }}
            aria-label="Select token to pay"
          >
            <TokenIcon token={payToken} size={26} />

            <span>
              {label(payToken)}
            </span>

            <span aria-hidden="true">⌄</span>
          </button>
        </div>

        <div className="token-meta">
          <span>
            {payToken.name}
            {!payToken.supported && " · Swap unavailable"}
          </span>
          <span>{usdValue(payToken, payAmount)}</span>
        </div>
      </div>

      {/* SWITCH TOKENS */}
      <div className="swap-direction">
        <button
          type="button"
          className="swap-direction-button"
          onClick={switchTokens}
          aria-label="Switch tokens"
          title="Switch tokens"
        >
          ↓↑
        </button>
      </div>

      {/* YOU RECEIVE */}
      <div className="token-box">
        <div className="token-box-top">
          <label htmlFor="receive-amount">You receive</label>
          <span>To</span>
        </div>

        <div className="token-input-row">
          <input
            id="receive-amount"
            type="text"
            placeholder="0.00"
            value={
              loadingQuote
                ? "Getting quote..."
                : receiveAmount
            }
            readOnly
          />

          <button
            type="button"
            className="token-selector"
            onClick={() => {
              setSelecting("receive");
              setTokenSearch("");
            }}
            aria-label="Select token to receive"
          >
            <TokenIcon token={receiveToken} size={26} />

            <span>
              {label(receiveToken)}
            </span>

            <span aria-hidden="true">⌄</span>
          </button>
        </div>

        <div className="token-meta">
          <span>
            {receiveToken.name}
            {!receiveToken.supported && " · Swap unavailable"}
          </span>
          <span>{usdValue(receiveToken, receiveAmount)}</span>
        </div>
      </div>

      {supportedPair && (
        <div className="swap-info">
          <span>Network</span>
          <span>Connected wallet network</span>
        </div>
      )}

      {!supportedPair && (
        <p className="swap-warning">
          This token is available in the selector, but the
          current contract only supports PILOT and USDC swaps.
        </p>
      )}

      {account && chain && chain !== "evm" && (
        <p className="swap-warning">
          You are connected to {chain === "solana" ? "Solana" : "Bitcoin"} ({nativeSymbol}).
          Swaps run on the EVM contract — connect an EVM wallet to swap.
        </p>
      )}

      {error && (
        <div className="swap-error" role="alert">
          {error}
        </div>
      )}

      {liquidity && (
        <button
          type="button"
          className="swap-btn"
          onClick={handleFundPool}
          disabled={funding}
          style={{ marginBottom: 10 }}
        >
          {funding
            ? "Adding liquidity…"
            : `Add ${liquidity.symbol} to swap pool (from my wallet)`}
        </button>
      )}

      {txHash && (
        <div className="swap-success" role="status">
          <TxMessage text={`Swap confirmed. Transaction: ${txHash}`} />
        </div>
      )}

      {message && (
        <div className="swap-success" role="status">
          <TxMessage text={message} />
        </div>
      )}

      {/* SWAP BUTTON */}
      <button
        type="button"
        className="swap-btn"
        onClick={handleSwap}
        disabled={
          swapping ||
          loadingQuote ||
          !account ||
          !signer ||
          !supportedPair ||
          !payAmount ||
          !Number.isFinite(Number(payAmount)) ||
          Number(payAmount) <= 0
        }
      >
        {!account
          ? "Connect Wallet"
          : !signer
            ? "Switch to an EVM wallet"
          : swapping
            ? "Swapping..."
            : !supportedPair
              ? "Pair Not Supported"
              : !payAmount
                ? "Enter an Amount"
                : "Swap"}
      </button>

      {/* TOKEN SELECTOR MODAL */}
      {selecting && (
        <div
          className="token-modal-overlay"
          onClick={closeTokenModal}
        >
          <div
            className="token-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Select a token"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="token-modal-header">
              <h3>Select a token</h3>

              <button
                type="button"
                className="token-modal-close"
                onClick={closeTokenModal}
                aria-label="Close token selector"
              >
                ×
              </button>
            </div>

            <input
              type="text"
              className="token-search"
              placeholder="Search name or symbol"
              value={tokenSearch}
              onChange={(event) =>
                setTokenSearch(event.target.value)
              }
              autoComplete="off"
            />

            <div className="token-options-list">
              {filteredTokens.map((token) => {
                const alreadySelected =
                  (selecting === "pay" &&
                    token.symbol === payToken.symbol) ||
                  (selecting === "receive" &&
                    token.symbol === receiveToken.symbol);

                return (
                  <button
                    type="button"
                    key={token.symbol}
                    className={`token-option ${
                      alreadySelected ? "selected" : ""
                    }`}
                    onClick={() => chooseToken(token)}
                  >
                    <TokenIcon token={token} size={38} />

                    <span className="token-option-details">
                      <strong>
                        {label(token)}
                      </strong>

                      <small>{token.name}</small>
                    </span>

                    <span className="token-option-right">
                      <strong>
                        {getPrice(token)
                          ? formatUsd(getPrice(token).usd)
                          : "—"}
                      </strong>
                      <small
                        className={`token-option-status ${
                          token.supported ? "ok" : "off"
                        }`}
                      >
                        {token.supported ? "Swappable" : "Price only"}
                      </small>
                    </span>
                  </button>
                );
              })}

              {filteredTokens.length === 0 && (
                <p className="token-empty-state">
                  No tokens found.
                </p>
              )}
            </div>

            <p className="token-modal-note">
              Selecting a token does not guarantee that a
              swap is available. Only PILOT and USDC are
              supported by the current AllSwap contract.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default SwapCard;
 
