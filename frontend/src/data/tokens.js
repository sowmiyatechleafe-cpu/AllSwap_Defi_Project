// ==================================================
// TOKEN REGISTRY
// One place that describes every token shown in the app.
//
//  symbol        key used by contract.js (TOKEN_CONFIG / swap functions)
//  displaySymbol label shown in the UI (testnet mocks use an "m" prefix)
//  coingeckoId   which real-world asset to take the LIVE price from
//  supported     true only for pairs the AllSwap contract can swap
//  color/glyph   fallback badge if the remote icon cannot load
// ==================================================

export const TOKENS = [
  {
    symbol: "PILOT",
    name: "Pilot Token",
    type: "custom",
    own: true,
    estimate: true,
    supported: true,
    color: "#2563eb",
    glyph: "P",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    type: "custom",
    coingeckoId: "usd-coin",
    estimate: true,
    supported: true,
    color: "#2775ca",
    glyph: "$",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    type: "native",
    coingeckoId: "ethereum",
    supported: false,
    color: "#627eea",
    glyph: "Ξ",
  },
  {
    symbol: "WBTC",
    displaySymbol: "mWBTC",
    name: "Wrapped Bitcoin",
    type: "erc20",
    coingeckoId: "wrapped-bitcoin",
    estimate: true,
    supported: false,
    color: "#f7931a",
    glyph: "₿",
  },
  {
    symbol: "DAI",
    displaySymbol: "mDAI",
    name: "Dai Stablecoin",
    type: "erc20",
    coingeckoId: "dai",
    estimate: true,
    supported: false,
    color: "#f5ac37",
    glyph: "◈",
  },
  {
    symbol: "LINK",
    displaySymbol: "mLINK",
    name: "Chainlink",
    type: "erc20",
    coingeckoId: "chainlink",
    estimate: true,
    supported: false,
    color: "#2a5ada",
    glyph: "⬡",
  },
  {
    symbol: "UNI",
    displaySymbol: "mUNI",
    name: "Uniswap",
    type: "erc20",
    coingeckoId: "uniswap",
    estimate: true,
    supported: false,
    color: "#ff007a",
    glyph: "U",
  },
  {
    symbol: "USDT",
    displaySymbol: "mUSDT",
    name: "Tether USD",
    type: "erc20",
    coingeckoId: "tether",
    estimate: true,
    supported: false,
    color: "#26a17b",
    glyph: "₮",
  },
];

export const TOKEN_BY_SYMBOL = Object.fromEntries(
  TOKENS.map((token) => [token.symbol, token])
);

export const label = (token) => token.displaySymbol || token.symbol;

// CoinGecko ids we need to request (PILOT has no market listing)
export const COINGECKO_IDS = TOKENS.filter((t) => t.coingeckoId).map(
  (t) => t.coingeckoId
);
