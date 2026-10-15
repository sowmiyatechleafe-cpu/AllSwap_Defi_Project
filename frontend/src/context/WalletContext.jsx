/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ethers } from "ethers";

import {
  discoverEvmWallets,
  discoverSolanaWallets,
  discoverBitcoinWallets,
  connectSolana,
  disconnectSolana,
  connectBitcoin,
  fetchSolBalance,
  fetchBtcBalance,
  nativeSymbolForChainId,
} from "../wallets/walletRegistry.js";

const WalletContext = createContext(null);

const LAST_KEY = "allswap-last-wallet";

const readLast = () => {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) || "null");
  } catch {
    return null;
  }
};
const writeLast = (v) => {
  try {
    if (v) localStorage.setItem(LAST_KEY, JSON.stringify(v));
    else localStorage.removeItem(LAST_KEY);
  } catch {
    /* storage unavailable – ignore */
  }
};

const friendlyError = (err, walletName) => {
  if (err?.code === 4001 || err?.code === "ACTION_REJECTED" || err?.code === 4100 && /reject|denied/i.test(err?.message || "")) {
    return `Connection was rejected in ${walletName}.`;
  }
  if (err?.code === -32002) {
    return `${walletName} already has a pending request. Open the extension and approve it.`;
  }
  if (/user rejected|rejected the request|declined|denied|cancel/i.test(err?.message || "")) {
    return `Connection was rejected in ${walletName}.`;
  }
  return err?.shortMessage || err?.message || `Failed to connect ${walletName}.`;
};

export function WalletProvider({ children }) {
  // ---------- connection state ----------
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [nativeSymbol, setNativeSymbol] = useState("ETH");
  const [network, setNetwork] = useState(null);
  const [chain, setChain] = useState(null); // "evm" | "solana" | "bitcoin"
  const [activeWallet, setActiveWallet] = useState(null); // {id,name,icon,chain}

  // EVM only (swap / token contracts use these)
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  // ---------- discovered wallets ----------
  const [wallets, setWallets] = useState({ evm: [], solana: [], bitcoin: [] });
  const [modalOpen, setModalOpen] = useState(false);

  const activeRef = useRef(null); // the wallet object currently connected
  activeRef.current = activeWallet;

  /* --------------------------------------------------
   * Discover every installed wallet extension.
   * EVM wallets use EIP-6963, so any number of them can
   * be installed at once without fighting over
   * `window.ethereum` (this was the multi-wallet bug).
   * -------------------------------------------------- */
  useEffect(() => {
    const refresh = () =>
      setWallets({
        evm: discoverEvmWallets.list(),
        solana: discoverSolanaWallets.list(),
        bitcoin: discoverBitcoinWallets.list(),
      });

    const offs = [
      discoverEvmWallets.subscribe(refresh),
      discoverSolanaWallets.subscribe(refresh),
      discoverBitcoinWallets.subscribe(refresh),
    ];
    refresh();

    // extensions inject slowly – look again a couple of times
    const timers = [400, 1200, 3000].map((ms) => setTimeout(refresh, ms));

    return () => {
      offs.forEach((off) => off && off());
      timers.forEach(clearTimeout);
    };
  }, []);

  const resetState = useCallback(() => {
    setAccount(null);
    setBalance(null);
    setNetwork(null);
    setProvider(null);
    setSigner(null);
    setChain(null);
    setActiveWallet(null);
    setNativeSymbol("ETH");
  }, []);

  /* --------------------------------------------------
   * EVM
   * -------------------------------------------------- */
  const loadEvm = useCallback(async (wallet, address) => {
    const browserProvider = new ethers.BrowserProvider(wallet.provider);
    const [walletSigner, walletBalance, networkInfo] = await Promise.all([
      browserProvider.getSigner(address),
      browserProvider.getBalance(address),
      browserProvider.getNetwork(),
    ]);

    setProvider(browserProvider);
    setSigner(walletSigner);
    setAccount(address);
    setBalance(ethers.formatEther(walletBalance));
    setNetwork(networkInfo);
    setNativeSymbol(nativeSymbolForChainId(Number(networkInfo.chainId)));
    setChain("evm");
    setActiveWallet(wallet);
    setError("");
  }, []);

  /* --------------------------------------------------
   * Solana / Bitcoin
   * -------------------------------------------------- */
  const loadSolana = useCallback(async (wallet, address) => {
    setProvider(null);
    setSigner(null);
    setAccount(address);
    setNetwork({ name: "Solana", chainId: "mainnet-beta" });
    setNativeSymbol("SOL");
    setChain("solana");
    setActiveWallet(wallet);
    setBalance(null);
    setError("");
    try {
      setBalance(await fetchSolBalance(address));
    } catch (err) {
      console.warn("Could not load SOL balance:", err);
    }
  }, []);

  const loadBitcoin = useCallback(async (wallet, address) => {
    setProvider(null);
    setSigner(null);
    setAccount(address);
    setNetwork({ name: "Bitcoin", chainId: "mainnet" });
    setNativeSymbol("BTC");
    setChain("bitcoin");
    setActiveWallet(wallet);
    setBalance(null);
    setError("");
    try {
      setBalance(await fetchBtcBalance(wallet, address));
    } catch (err) {
      console.warn("Could not load BTC balance:", err);
    }
  }, []);

  /* --------------------------------------------------
   * Connect a specific wallet chosen in the picker
   * -------------------------------------------------- */
  const connectWallet = useCallback(
    async (wallet) => {
      // Called with no wallet (e.g. old buttons) → open the picker.
      if (!wallet || typeof wallet.chain !== "string") {
        setError("");
        setModalOpen(true);
        return;
      }

      setError("");
      setConnecting(true);

      try {
        if (wallet.chain === "evm") {
          const accounts = await wallet.provider.request({
            method: "eth_requestAccounts",
          });
          if (!accounts?.length) {
            throw new Error(`Please select an account in ${wallet.name}.`);
          }
          await loadEvm(wallet, accounts[0]);
        } else if (wallet.chain === "solana") {
          const address = await connectSolana(wallet);
          await loadSolana(wallet, address);
        } else {
          const address = await connectBitcoin(wallet);
          await loadBitcoin(wallet, address);
        }

        writeLast({ chain: wallet.chain, id: wallet.id });
        setModalOpen(false);
      } catch (err) {
        console.error(`${wallet.name} connection error:`, err);
        setError(friendlyError(err, wallet.name));
      } finally {
        setConnecting(false);
      }
    },
    [loadEvm, loadSolana, loadBitcoin]
  );

  /* --------------------------------------------------
   * Disconnect (dapp state only; does not touch the wallet)
   * -------------------------------------------------- */
  const disconnectWallet = useCallback(async () => {
    const wallet = activeRef.current;

    try {
      if (wallet?.chain === "evm") {
        await wallet.provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } else if (wallet?.chain === "solana") {
        await disconnectSolana(wallet);
      }
    } catch (err) {
      // not every wallet supports this – the UI still disconnects cleanly
      console.warn("Wallet-side disconnect not supported:", err);
    }

    writeLast(null);
    resetState();
    setError("");
  }, [resetState]);

  /* --------------------------------------------------
   * Silently restore the previous session once the
   * wallet that was used last has been discovered.
   * -------------------------------------------------- */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || account) return;
    const last = readLast();
    if (!last) {
      restoredRef.current = true;
      return;
    }
    const wallet = (wallets[last.chain] || []).find((w) => w.id === last.id);
    if (!wallet) return; // not injected yet – effect re-runs when list changes

    restoredRef.current = true;

    (async () => {
      try {
        if (wallet.chain === "evm") {
          const accounts = await wallet.provider.request({
            method: "eth_accounts",
          });
          if (accounts?.length) await loadEvm(wallet, accounts[0]);
        } else if (wallet.chain === "solana") {
          const address = await connectSolana(wallet, { silent: true });
          if (address) await loadSolana(wallet, address);
        } else if (wallet.silentAccounts) {
          const address = await wallet.silentAccounts();
          if (address) await loadBitcoin(wallet, address);
        }
      } catch (err) {
        console.warn("Could not restore wallet session:", err);
      }
    })();
  }, [wallets, account, loadEvm, loadSolana, loadBitcoin]);

  /* --------------------------------------------------
   * Listen for account / network changes on the wallet
   * that is actually connected (EVM)
   * -------------------------------------------------- */
  useEffect(() => {
    if (!activeWallet || activeWallet.chain !== "evm") return;
    const eth = activeWallet.provider;
    if (!eth?.on) return;

    const onAccounts = async (accounts) => {
      if (!accounts?.length) {
        writeLast(null);
        resetState();
        return;
      }
      try {
        await loadEvm(activeWallet, accounts[0]);
      } catch (err) {
        console.error("Account switch error:", err);
      }
    };

    const onChain = async () => {
      try {
        const accounts = await eth.request({ method: "eth_accounts" });
        if (accounts?.length) await loadEvm(activeWallet, accounts[0]);
      } catch (err) {
        console.error("Network switch error:", err);
      }
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [activeWallet, loadEvm, resetState]);

  // Solana account switch
  useEffect(() => {
    if (!activeWallet || activeWallet.chain !== "solana") return;
    if (!activeWallet.onAccountChange) return;
    return activeWallet.onAccountChange((address) => {
      if (!address) {
        writeLast(null);
        resetState();
      } else {
        loadSolana(activeWallet, address);
      }
    });
  }, [activeWallet, loadSolana, resetState]);

  const value = useMemo(
    () => ({
      account,
      balance,
      nativeSymbol,
      network,
      chain,
      isEvm: chain === "evm",
      activeWallet,
      provider,
      signer,
      connecting,
      error,
      wallets,
      modalOpen,
      openWalletModal: () => {
        setError("");
        setModalOpen(true);
      },
      closeWalletModal: () => setModalOpen(false),
      connectWallet,
      disconnectWallet,
    }),
    [
      account,
      balance,
      nativeSymbol,
      network,
      chain,
      activeWallet,
      provider,
      signer,
      connecting,
      error,
      wallets,
      modalOpen,
      connectWallet,
      disconnectWallet,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
