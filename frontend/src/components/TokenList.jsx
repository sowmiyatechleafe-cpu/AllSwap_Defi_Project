import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "../context/WalletContext";
import { usePrices, formatUsd, REFRESH_MS } from "../context/PriceContext.jsx";
import { getAllTokenBalances } from "../contracts/contract";
import { TOKENS, label } from "../data/tokens.js";
import TokenIcon from "./TokenIcon.jsx";
import WalletTotalCard from "./WalletTotalCard.jsx";
import TokenModal from "./TokenModal.jsx";

const TokenList = () => {
  const { account, provider, network, chain, balance: nativeBalance, nativeSymbol, activeWallet } = useWallet();
  const { getPrice, loading: pricesLoading, error: priceError, updatedAt } =
    usePrices();

  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedToken, setSelectedToken] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const lastWalletKey = useRef("");

  // called by the modal after a send / swap so balances update right away
  const refreshBalances = useCallback(() => setRefreshTick((n) => n + 1), []);
  const closeModal = useCallback(() => setSelectedToken(null), []);

  useEffect(() => {
    let cancelled = false;

    const loadBalances = async (silent) => {
      if (!provider || !account) {
        setBalances({});
        setLoading(false);
        setError("");
        return;
      }

      try {
        if (!silent) {
          setBalances({});
          setLoading(true);
        }
        setError("");

        const result = await getAllTokenBalances(provider, account);

        if (!cancelled) setBalances(result);
      } catch (err) {
        console.error("Failed to load token balances:", err);

        if (!cancelled) {
          setError(
            "Unable to load balances. Check your wallet network and token contract addresses."
          );
        }
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };

    // first load shows the spinner; later refreshes (after send/swap) are silent
    const walletKey = `${account || ""}`;
    const walletChanged = lastWalletKey.current !== walletKey;
    lastWalletKey.current = walletKey;
    loadBalances(!walletChanged);

    const timer = setInterval(() => {
      if (!document.hidden) loadBalances(true);
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [provider, account, refreshTick]);

  const hasBalances = Object.keys(balances).length > 0;

  const summary = useMemo(() => {
    let total = 0;
    let priced = 0;
    let unpriced = 0;
    let estimated = false;
    const holdings = [];
    let chartExcludes = false;

    for (const token of TOKENS) {
      const entry = balances[token.symbol];
      if (!(entry?.configured && entry.balance != null)) continue;

      const amount = Number(entry.balance);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const price = getPrice(token);
      if (!price) {
        unpriced += 1;
        continue;
      }

      total += amount * price.usd;
      priced += 1;
      if (token.estimate) estimated = true;

      if (token.coingeckoId) {
        holdings.push({ id: token.coingeckoId, amount, price: price.usd });
      } else {
        chartExcludes = true;
      }
    }

    return { total, priced, unpriced, estimated, holdings, chartExcludes };
  }, [balances, getPrice]);

  const totalText =
    loading && !hasBalances
      ? "Loading…"
      : error && !hasBalances
        ? "Unavailable"
        : pricesLoading && summary.priced === 0
          ? "Loading…"
          : summary.priced === 0
            ? "Unavailable"
            : formatUsd(summary.total);

  return (
    <section className="token-section">
      {account && (
        <>
          <h2 className="wallet-total-title">Total wallet balance</h2>
          <WalletTotalCard
            totalText={totalText}
            estimated={summary.estimated && summary.priced > 0}
            unpriced={summary.unpriced}
            holdings={summary.holdings}
            chartExcludes={summary.chartExcludes}
            updatedAt={updatedAt}
          />
        </>
      )}

      <div className="token-network-header">
        <div>
          <h2>Supported tokens</h2>
          <p>
            {account
              ? "Live market prices and your wallet balances"
              : "Live market prices · connect your wallet to see balances"}
          </p>
        </div>

        <div className="network-badge">
          <span className="network-dot" />
          {account && network?.name && network.name !== "unknown"
            ? network.name
            : "Sepolia"}
        </div>
      </div>

      {!account && (
        <div className="tokens-empty-state">
          Connect a wallet to view your token balances.
        </div>
      )}

      {account && chain && chain !== "evm" && (
        <div className="native-card">
          <div>
            <h3>
              {chain === "solana" ? "Solana" : "Bitcoin"} wallet connected
            </h3>
            <p>
              {activeWallet?.name} · {account.slice(0, 6)}…{account.slice(-4)}.
              Token balances and swaps below use the EVM contracts — connect
              an EVM wallet to use them.
            </p>
          </div>
          <strong>
            {nativeBalance == null
              ? "—"
              : `${Number(nativeBalance).toLocaleString("en-US", {
                  maximumFractionDigits: 6,
                })} ${nativeSymbol}`}
          </strong>
        </div>
      )}

      {error && <p className="tokens-error">{error}</p>}
      {priceError && <p className="tokens-error">{priceError}</p>}

      <div className="token-table">
        <div className="token-table-head">
          <span>Token</span>
          <span className="col-right">Price</span>
          <span className="col-right col-change">24h</span>
          <span className="col-right">Balance</span>
        </div>

        {TOKENS.map((token) => {
          const price = getPrice(token);
          const tokenBalance = balances[token.symbol];

          const isConfigured =
            tokenBalance?.configured === true &&
            tokenBalance?.balance != null;

          const balanceNumber = isConfigured
            ? Number(tokenBalance.balance)
            : null;

          const valueUsd =
            balanceNumber != null && price ? balanceNumber * price.usd : null;

          const change = price?.change24h;

          return (
            <div
              className="token-card token-card-clickable"
              key={token.symbol}
              role="button"
              tabIndex={0}
              aria-label={`Open ${label(token)} actions`}
              onClick={() => setSelectedToken(token)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedToken(token);
                }
              }}
            >
              <div className="token-info">
                <TokenIcon token={token} size={40} />

                <div className="token-name">
                  <h3>
                    {label(token)}
                    {token.own && <span className="pill">Your token</span>}
                  </h3>
                  <span>{token.name}</span>
                </div>
              </div>

              <div className="token-price col-right">
                <strong className={price ? "" : "muted"}>
                  {price
                    ? formatUsd(price.usd)
                    : pricesLoading
                      ? "…"
                      : token.own
                        ? "Connect wallet"
                        : "—"}
                </strong>
              </div>

              <div
                className={`col-right col-change ${
                  change == null ? "" : change >= 0 ? "up" : "down"
                }`}
              >
                {change == null
                  ? "—"
                  : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
              </div>

              <div className="token-balance col-right">
                <strong>
                  {!account
                    ? "—"
                    : loading
                      ? "Loading…"
                      : isConfigured
                        ? balanceNumber.toLocaleString("en-US", {
                            maximumFractionDigits: 6,
                          })
                        : "Not configured"}
                </strong>
                {valueUsd != null && (
                  <small>
                    {token.estimate ? "≈ " : ""}
                    {formatUsd(valueUsd)}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!account ? null : (
        <p className="price-footnote">Tap any token to send, receive or swap it.</p>
      )}

      <p className="price-footnote">
        Prices from CoinGecko, refreshed every {REFRESH_MS / 1000} seconds
        {updatedAt ? ` · last update ${updatedAt.toLocaleTimeString()}` : ""}.
        Testnet tokens marked “m” are mocks that follow the real asset’s
        price for display only. PILOT’s price comes from the AllSwap
        contract.
      </p>

      {selectedToken && (
        <TokenModal
          token={selectedToken}
          balances={balances}
          onClose={closeModal}
          onRefresh={refreshBalances}
          initialTab="send"
        />
      )}
    </section>
  );
};

export default TokenList;
