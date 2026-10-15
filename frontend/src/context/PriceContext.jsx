/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ethers } from "ethers";

import { useWallet } from "./WalletContext.jsx";
import { COINGECKO_IDS } from "../data/tokens.js";
import {
  PILOT_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
  SWAP_CONTRACT_ADDRESS,
} from "../contracts/contract.js";
import PilotTokenABI from "../contracts/PilotToken.json";
import MockUSDCABI from "../contracts/MockUSDC.json";
import PilotSwapABI from "../contracts/PilotSwap.json";

const PriceContext = createContext(null);

// Default 30s. Override with VITE_PRICE_REFRESH_MS (minimum 10s): CoinGecko's
// free API rate-limits anything faster.
export const REFRESH_MS = Math.max(
  10_000,
  Number(import.meta.env.VITE_PRICE_REFRESH_MS) || 30_000
);
const ZERO = "0x0000000000000000000000000000000000000000";

const MARKETS_URL =
  "https://api.coingecko.com/api/v3/coins/markets" +
  `?vs_currency=usd&ids=${COINGECKO_IDS.join(",")}` +
  "&price_change_percentage=24h&per_page=50&sparkline=false";

export function PriceProvider({ children }) {
  const { provider } = useWallet();

  // { [coingeckoId]: { usd, change24h, image } }
  const [market, setMarket] = useState({});
  const [pilotUsd, setPilotUsd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  // ---------- live market prices (CoinGecko) ----------
  useEffect(() => {
    let cancelled = false;

    async function loadMarket() {
      try {
        const response = await fetch(MARKETS_URL, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(
            response.status === 429
              ? "Price API rate limit reached. Retrying shortly."
              : `Price API error (${response.status}).`
          );
        }

        const rows = await response.json();
        if (cancelled) return;

        const next = {};

        for (const row of rows) {
          next[row.id] = {
            usd: row.current_price,
            change24h: row.price_change_percentage_24h,
            image: row.image,
          };
        }

        setMarket(next);
        setUpdatedAt(new Date());
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Live prices unavailable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMarket();

    const timer = setInterval(() => {
      if (!document.hidden) loadMarket();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // ---------- PILOT price (from the AllSwap contract) ----------
  // AllSwap trades PILOT against USDC at `pilotPrice` PILOT per 1 USDC,
  // so   1 PILOT = (USDC price in USD) / pilotPrice.
  const usdcUsd = market["usd-coin"]?.usd;

  useEffect(() => {
    let cancelled = false;

    async function loadPilotPrice() {
      const configured = [
        PILOT_TOKEN_ADDRESS,
        USDC_TOKEN_ADDRESS,
        SWAP_CONTRACT_ADDRESS,
      ].every((a) => a && a !== ZERO && ethers.isAddress(a));

      if (!provider || !configured || !usdcUsd) {
        setPilotUsd(null);
        return;
      }

      try {
        const swap = new ethers.Contract(
          SWAP_CONTRACT_ADDRESS,
          PilotSwapABI,
          provider
        );
        const pilot = new ethers.Contract(
          PILOT_TOKEN_ADDRESS,
          PilotTokenABI,
          provider
        );
        const usdc = new ethers.Contract(
          USDC_TOKEN_ADDRESS,
          MockUSDCABI,
          provider
        );

        const [rate, pilotDec, usdcDec] = await Promise.all([
          swap.pilotPrice(),
          pilot.decimals(),
          usdc.decimals(),
        ]);

        // PILOT received for exactly 1 USDC
        const pilotPerUsdc =
          Number(rate) * 10 ** (Number(usdcDec) - Number(pilotDec));

        if (!cancelled) {
          setPilotUsd(pilotPerUsdc > 0 ? usdcUsd / pilotPerUsdc : null);
        }
      } catch (err) {
        console.error("Failed to read PILOT price:", err);
        if (!cancelled) setPilotUsd(null);
      }
    }

    loadPilotPrice();

    return () => {
      cancelled = true;
    };
  }, [provider, usdcUsd, updatedAt]);

  // ---------- helpers for components ----------
  const getPrice = useCallback(
    (token) => {
      if (token.own) {
        return pilotUsd == null
          ? null
          : { usd: pilotUsd, change24h: null, image: null };
      }
      return market[token.coingeckoId] || null;
    },
    [market, pilotUsd]
  );

  return (
    <PriceContext.Provider
      value={{ getPrice, loading, error, updatedAt }}
    >
      {children}
    </PriceContext.Provider>
  );
}

export function usePrices() {
  return useContext(PriceContext);
}

// ---------- formatting ----------
export function formatUsd(value) {
  if (value == null || !Number.isFinite(value)) return "—";

  const digits = value >= 1000 ? 2 : value >= 1 ? 2 : value >= 0.01 ? 4 : 6;

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}
