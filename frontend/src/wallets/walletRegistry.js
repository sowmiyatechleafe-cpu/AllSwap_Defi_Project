// ======================================================================
// WALLET REGISTRY
//
// Finds every wallet extension installed in the browser, for three
// networks, without any of them stepping on each other:
//
//   EVM      EIP-6963 "multi injected provider discovery". Each wallet
//            announces itself separately, so having MetaMask + Coinbase +
//            Rabby (etc.) installed at once no longer breaks
//            `window.ethereum`.
//   Solana   Wallet Standard registration + legacy injected providers
//            (Phantom, Solflare, Backpack, OKX).
//   Bitcoin  Unisat, Xverse, Leather, OKX, Phantom.
//
// Every wallet object looks like:
//   { id, name, icon, chain: "evm" | "solana" | "bitcoin", ...adapter }
// ======================================================================

const isBrowser = typeof window !== "undefined";

// ---------------------------------------------------------------- utils

/** Small colored letter badge used when a wallet provides no icon. */
const badge = (letter, color) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${color}"/><text x="32" y="43" font-family="Arial,sans-serif" font-size="32" font-weight="700" text-anchor="middle" fill="#fff">${letter}</text></svg>`
  );

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function makeStore() {
  const listeners = new Set();
  return {
    listeners,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit() {
      listeners.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      });
    },
  };
}

// ============================================================ EVM (6963)

const evmStore = makeStore();
const evmWallets = new Map(); // uuid -> wallet

function addEvmWallet(detail) {
  if (!detail?.info || !detail?.provider) return;
  const { info, provider } = detail;
  const id = info.rdns || info.uuid || info.name;
  if (evmWallets.has(id)) return;
  evmWallets.set(id, {
    id,
    name: info.name || "Browser wallet",
    icon: info.icon || badge("E", "#627eea"),
    chain: "evm",
    provider,
  });
  evmStore.emit();
}

/** Wallets that predate EIP-6963 only expose window.ethereum. */
function legacyEvmWallets() {
  if (!isBrowser || evmWallets.size > 0) return [];
  const eth = window.ethereum;
  if (!eth) return [];
  const list = Array.isArray(eth.providers) && eth.providers.length ? eth.providers : [eth];
  return list.map((p, i) => {
    let name = "Browser wallet";
    let color = "#627eea";
    if (p.isRabby) [name, color] = ["Rabby", "#7084ff"];
    else if (p.isCoinbaseWallet) [name, color] = ["Coinbase Wallet", "#0052ff"];
    else if (p.isBraveWallet) [name, color] = ["Brave Wallet", "#fb542b"];
    else if (p.isTrust || p.isTrustWallet) [name, color] = ["Trust Wallet", "#0500ff"];
    else if (p.isPhantom) [name, color] = ["Phantom", "#ab9ff2"];
    else if (p.isMetaMask) [name, color] = ["MetaMask", "#f6851b"];
    return {
      id: `legacy-evm-${i}-${norm(name)}`,
      name,
      icon: badge(name[0], color),
      chain: "evm",
      provider: p,
    };
  });
}

if (isBrowser) {
  window.addEventListener("eip6963:announceProvider", (e) => addEvmWallet(e.detail));
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export const discoverEvmWallets = {
  subscribe: evmStore.subscribe,
  list() {
    if (isBrowser) window.dispatchEvent(new Event("eip6963:requestProvider"));
    return [...evmWallets.values(), ...legacyEvmWallets()];
  },
};

// ================================================= SOLANA (Wallet Standard)

const solStore = makeStore();
const solStandard = new Map(); // name -> wallet-standard wallet

function registerStandardWallets(...wallets) {
  for (const w of wallets) {
    const chains = w?.chains || [];
    const hasSolana = chains.some((c) => String(c).startsWith("solana:"));
    if (!hasSolana || !w.features?.["standard:connect"]) continue;
    solStandard.set(w.name, w);
  }
  solStore.emit();
  return () => {
    for (const w of wallets) solStandard.delete(w.name);
    solStore.emit();
  };
}

if (isBrowser) {
  const api = Object.freeze({ register: registerStandardWallets });
  try {
    window.addEventListener("wallet-standard:register-wallet", (e) => {
      try {
        e.detail(api);
      } catch (err) {
        console.warn("Wallet Standard registration failed:", err);
      }
    });
  } catch {
    /* ignore */
  }
  try {
    class AppReadyEvent extends Event {
      constructor() {
        super("wallet-standard:app-ready", {
          bubbles: false,
          cancelable: false,
          composed: false,
        });
      }
      get detail() {
        return api;
      }
    }
    window.dispatchEvent(new AppReadyEvent());
  } catch {
    /* ignore */
  }
}

const standardToWallet = (w) => ({
  id: `sol-std-${norm(w.name)}`,
  name: w.name,
  icon: w.icon || badge("S", "#9945ff"),
  chain: "solana",
  standard: w,
  onAccountChange(cb) {
    const ev = w.features?.["standard:events"];
    if (!ev) return () => {};
    return ev.on("change", ({ accounts }) => {
      if (accounts) cb(accounts[0]?.address || null);
    });
  },
});

const legacySolanaCandidates = () => {
  if (!isBrowser) return [];
  const out = [];
  const add = (name, color, p) => {
    if (p && typeof p.connect === "function") {
      out.push({
        id: `sol-legacy-${norm(name)}`,
        name,
        icon: badge(name[0], color),
        chain: "solana",
        legacy: p,
        onAccountChange(cb) {
          const handler = (pk) => cb(pk ? pk.toString() : null);
          const gone = () => cb(null);
          p.on?.("accountChanged", handler);
          p.on?.("disconnect", gone);
          return () => {
            p.removeListener?.("accountChanged", handler);
            p.removeListener?.("disconnect", gone);
          };
        },
      });
    }
  };
  add("Phantom", "#ab9ff2", window.phantom?.solana);
  add("Solflare", "#fc8c10", window.solflare);
  add("Backpack", "#e33e3f", window.backpack);
  add("OKX Wallet", "#111111", window.okxwallet?.solana);
  // generic window.solana only if it is none of the above
  const s = window.solana;
  if (
    s &&
    ![window.phantom?.solana, window.solflare, window.backpack, window.okxwallet?.solana].includes(s)
  ) {
    add("Solana Wallet", "#9945ff", s);
  }
  return out;
};

export const discoverSolanaWallets = {
  subscribe: solStore.subscribe,
  list() {
    const std = [...solStandard.values()].map(standardToWallet);
    const seen = new Set(std.map((w) => norm(w.name)));
    const legacy = legacySolanaCandidates().filter((w) => !seen.has(norm(w.name)));
    return [...std, ...legacy];
  },
};

export async function connectSolana(wallet, { silent = false } = {}) {
  if (wallet.standard) {
    const res = await wallet.standard.features["standard:connect"].connect(
      silent ? { silent: true } : undefined
    );
    const acc = res?.accounts?.[0] || wallet.standard.accounts?.[0];
    return acc?.address || null;
  }
  const p = wallet.legacy;
  const res = await p.connect(silent ? { onlyIfTrusted: true } : undefined);
  const pk = res?.publicKey || p.publicKey;
  return pk ? pk.toString() : null;
}

export async function disconnectSolana(wallet) {
  if (wallet.standard) {
    await wallet.standard.features["standard:disconnect"]?.disconnect();
  } else {
    await wallet.legacy?.disconnect?.();
  }
}

// ================================================================ BITCOIN

const btcStore = makeStore();

const pickBtcAddress = (list) => {
  if (!Array.isArray(list)) return null;
  const btc = list.filter((a) => !a.symbol || a.symbol === "BTC");
  const pick =
    btc.find((a) => a.purpose === "payment") ||
    btc.find((a) => a.type === "p2wpkh") ||
    btc[0] ||
    list[0];
  return pick?.address || null;
};

const bitcoinCandidates = () => {
  if (!isBrowser) return [];
  const out = [];

  if (window.unisat?.requestAccounts) {
    const u = window.unisat;
    out.push({
      id: "btc-unisat",
      name: "UniSat",
      icon: badge("U", "#f7931a"),
      chain: "bitcoin",
      connect: async () => (await u.requestAccounts())?.[0],
      silentAccounts: async () => (await u.getAccounts())?.[0] || null,
      getBalance: async () => (await u.getBalance())?.total / 1e8,
    });
  }

  const xverse = window.XverseProviders?.BitcoinProvider;
  if (xverse?.request) {
    out.push({
      id: "btc-xverse",
      name: "Xverse",
      icon: badge("X", "#ee7a30"),
      chain: "bitcoin",
      connect: async () => {
        const params = { purposes: ["payment"], message: "Connect to AllSwap" };
        let res;
        try {
          res = await xverse.request("getAddresses", params);
        } catch {
          res = await xverse.request("getAccounts", params);
        }
        if (res?.error) throw new Error(res.error.message || "Xverse rejected the request");
        const r = res?.result;
        return pickBtcAddress(r?.addresses || r);
      },
    });
  }

  if (window.LeatherProvider?.request) {
    const l = window.LeatherProvider;
    out.push({
      id: "btc-leather",
      name: "Leather",
      icon: badge("L", "#12100f"),
      chain: "bitcoin",
      connect: async () => {
        const res = await l.request("getAddresses");
        if (res?.error) throw new Error(res.error.message || "Leather rejected the request");
        return pickBtcAddress(res?.result?.addresses);
      },
    });
  }

  if (window.okxwallet?.bitcoin?.connect) {
    const o = window.okxwallet.bitcoin;
    out.push({
      id: "btc-okx",
      name: "OKX Wallet",
      icon: badge("O", "#111111"),
      chain: "bitcoin",
      connect: async () => (await o.connect())?.address,
    });
  }

  if (window.phantom?.bitcoin?.requestAccounts) {
    const p = window.phantom.bitcoin;
    out.push({
      id: "btc-phantom",
      name: "Phantom",
      icon: badge("P", "#ab9ff2"),
      chain: "bitcoin",
      connect: async () => pickBtcAddress(await p.requestAccounts()),
    });
  }

  return out;
};

export const discoverBitcoinWallets = {
  subscribe: btcStore.subscribe,
  list: bitcoinCandidates,
};

export async function connectBitcoin(wallet) {
  const address = await wallet.connect();
  if (!address) throw new Error(`No Bitcoin address returned by ${wallet.name}.`);
  return address;
}

// =============================================================== BALANCES

const SOLANA_RPC =
  import.meta.env?.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function fetchSolBalance(address) {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return String(json.result.value / 1e9);
}

export async function fetchBtcBalance(wallet, address) {
  try {
    const v = await wallet.getBalance?.();
    if (Number.isFinite(v)) return String(v);
  } catch {
    /* fall through to public explorer */
  }
  const res = await fetch(`https://mempool.space/api/address/${address}`);
  if (!res.ok) throw new Error("Bitcoin balance lookup failed");
  const j = await res.json();
  const sats =
    j.chain_stats.funded_txo_sum -
    j.chain_stats.spent_txo_sum +
    (j.mempool_stats.funded_txo_sum - j.mempool_stats.spent_txo_sum);
  return String(sats / 1e8);
}

// ============================================================ EVM helpers

const NATIVE = {
  1: "ETH",
  10: "ETH",
  56: "BNB",
  97: "tBNB",
  137: "POL",
  42161: "ETH",
  43114: "AVAX",
  8453: "ETH",
  11155111: "ETH",
  31337: "ETH",
};

export const nativeSymbolForChainId = (id) => NATIVE[id] || "ETH";
