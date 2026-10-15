# My DeFi / AllSwap

A React + Vite frontend with a Hardhat smart-contract demo and MetaMask connection.

## Run the frontend

From the `my-defi` root:

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Run the local blockchain

Open a second terminal:

```bash
cd blockchain
npm install
npm run node
```

Keep this terminal running.

Open a third terminal:

```bash
cd blockchain
npm run deploy:local
```

Hardhat will print the deployed contract addresses.

Copy those three addresses into:

`frontend/.env.local`

```env
VITE_PILOT_TOKEN_ADDRESS=...
VITE_USDC_TOKEN_ADDRESS=...
VITE_SWAP_CONTRACT_ADDRESS=...
```

Then restart Vite.

## MetaMask

Add the local Hardhat network to MetaMask:

- Network name: Hardhat Local
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: ETH

Import one of the private keys printed by `npm run node`.

Then click **Connect Wallet** in AllSwap and pick any installed wallet.

## Local swap flow

The current smart contract supports:

- USDC -> PILOT
- PILOT -> USDC

Each swap requires an ERC-20 approval transaction followed by the swap transaction.

The current contract does **not** implement ETH swaps. The UI reports this instead of pretending ETH swapping works.

## Validation

The source was checked with ESLint before the final packaging. A clean dependency install/build could not be completed inside the Linux test container because the uploaded project originally contained Windows-native `node_modules`; the final ZIP removes those modules so `npm install` can install the correct binaries for your Windows machine.

## Branding, dark theme and live token prices

- **Logo / icons** – `public/logo.png` (light theme), `public/logo-dark.png` (dark theme),
  `public/logo-icon.png` (PILOT token icon, mobile navbar), `public/favicon.png`.
- **Theme** – dark by default; the sun/moon button in the navbar switches theme and the
  choice is saved in `localStorage`. All colours are CSS variables at the top of `frontend/src/index.css`.
- **Token list** – edit `frontend/src/data/tokens.js` to add/remove tokens
  (set `coingeckoId` for the live price source).
- **Live prices** – `frontend/src/context/PriceContext.jsx` reads CoinGecko's free
  `/coins/markets` endpoint every 30 s (price, 24 h change and official icon).
  PILOT's price is calculated from the AllSwap contract (`pilotPrice`) once the wallet is connected.
- `vite.config.js` now sets `publicDir: "../public"` so the logo/favicon are actually served.


## Wallets (EVM, Solana, Bitcoin)

AllSwap discovers every wallet extension installed in the browser and lets the
user choose one, so having 2, 3 or more wallets installed at once works.

- **EVM** – found through EIP-6963 (MetaMask, Rabby, Coinbase, Brave, Trust, OKX, …).
  This replaces the old `window.ethereum` lookup, which broke when several
  extensions fought over that single global.
- **Solana** – Wallet Standard + injected providers (Phantom, Solflare, Backpack, OKX).
- **Bitcoin** – UniSat, Xverse, Leather, OKX, Phantom.

Swaps, sending and token balances use the EVM contracts, so they need an EVM
wallet. A Solana or Bitcoin wallet connects and shows its native balance
(SOL / BTC). Code lives in `frontend/src/wallets/walletRegistry.js` and
`frontend/src/context/WalletContext.jsx`.
