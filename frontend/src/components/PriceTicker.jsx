import { TOKENS, label } from "../data/tokens.js";
import { usePrices, formatUsd } from "../context/PriceContext.jsx";
import TokenIcon from "./TokenIcon.jsx";

function Change({ value }) {
  if (value == null || !Number.isFinite(value)) return null;

  const up = value >= 0;

  return (
    <span className={`change ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(2)}%
    </span>
  );
}

export default function PriceTicker() {
  const { getPrice, loading, error } = usePrices();

  const items = TOKENS.map((token) => ({
    token,
    price: getPrice(token),
  })).filter((item) => item.price);

  if (!items.length) {
    return (
      <div className="ticker ticker-empty">
        <span className="live-dot" />
        {loading ? "Loading live prices…" : error || "Live prices unavailable"}
      </div>
    );
  }

  // duplicated once so the marquee loops seamlessly
  const loop = [...items, ...items];

  return (
    <div className="ticker" aria-label="Live token prices">
      <div className="ticker-live">
        <span className="live-dot" /> LIVE
      </div>

      <div className="ticker-viewport">
        <div className="ticker-track">
          {loop.map(({ token, price }, index) => (
            <div className="ticker-item" key={`${token.symbol}-${index}`}>
              <TokenIcon token={token} size={20} />
              <strong>{label(token)}</strong>
              <span>{formatUsd(price.usd)}</span>
              <Change value={price.change24h} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
