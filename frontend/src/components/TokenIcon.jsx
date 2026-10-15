import { useState } from "react";
import { usePrices } from "../context/PriceContext.jsx";

/**
 * Token icon.
 *  - PILOT      -> your own AllSwap icon
 *  - real coins -> official icon returned by the live price API
 *  - fallback   -> coloured badge with the token glyph (offline / blocked)
 */
export default function TokenIcon({ token, size = 32 }) {
  const { getPrice } = usePrices();
  const [failed, setFailed] = useState(false);

  const src = token.own
    ? "/logo-icon.png"
    : getPrice(token)?.image || null;

  const style = { width: size, height: size };

  if (src && !failed) {
    return (
      <img
        className={`token-img ${token.own ? "token-img-own" : ""}`}
        style={style}
        src={src}
        alt={`${token.symbol} icon`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="token-badge"
      style={{
        ...style,
        fontSize: size * 0.5,
        background: `linear-gradient(135deg, ${token.color}, ${token.color}aa)`,
      }}
      aria-hidden="true"
    >
      {token.glyph}
    </span>
  );
}
