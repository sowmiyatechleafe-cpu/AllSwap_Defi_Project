import { ethers } from "ethers";

import PilotTokenABI from "./PilotToken.json";
import MockUSDCABI from "./MockUSDC.json";
import PilotSwapABI from "./PilotSwap.json";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

// ==================================================
// DEPLOYED CONTRACT ADDRESSES
// ==================================================

export const PILOT_TOKEN_ADDRESS =
  import.meta.env.VITE_PILOT_TOKEN_ADDRESS || ZERO_ADDRESS;

export const USDC_TOKEN_ADDRESS =
  import.meta.env.VITE_USDC_TOKEN_ADDRESS || ZERO_ADDRESS;

export const SWAP_CONTRACT_ADDRESS =
  import.meta.env.VITE_SWAP_CONTRACT_ADDRESS || ZERO_ADDRESS;

// ==================================================
// STANDARD ERC-20 ABI
// ==================================================

export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

// ==================================================
// ALL TOKEN CONFIGURATIONS
// The object keys are the internal symbols used by the app.
// ==================================================

export const TOKEN_CONFIG = {
  PILOT: {
    name: "Pilot Token",
    address: PILOT_TOKEN_ADDRESS,
  },

  USDC: {
    name: "Mock USD Coin",
    address: USDC_TOKEN_ADDRESS,
  },

  WBTC: {
    name: "Mock Wrapped Bitcoin",
    address: import.meta.env.VITE_WBTC_TOKEN_ADDRESS || "",
    displaySymbol: "mWBTC",
  },

  DAI: {
    name: "Mock Dai Stablecoin",
    address: import.meta.env.VITE_DAI_TOKEN_ADDRESS || "",
    displaySymbol: "mDAI",
  },

  LINK: {
    name: "Mock Chainlink",
    address: import.meta.env.VITE_LINK_TOKEN_ADDRESS || "",
    displaySymbol: "mLINK",
  },

  UNI: {
    name: "Mock Uniswap",
    address: import.meta.env.VITE_UNI_TOKEN_ADDRESS || "",
    displaySymbol: "mUNI",
  },

  USDT: {
    name: "Mock Tether USD",
    address: import.meta.env.VITE_USDT_TOKEN_ADDRESS || "",
    displaySymbol: "mUSDT",
  },

  WETH: {
    name: "Mock Wrapped Ether",
    address: import.meta.env.VITE_WETH_TOKEN_ADDRESS || "",
    displaySymbol: "mWETH",
  },
};

// ==================================================
// ADDRESS VALIDATION
// ==================================================

function assertAddress(address, name) {
  if (
    !address ||
    !ethers.isAddress(address) ||
    address.toLowerCase() === ZERO_ADDRESS.toLowerCase()
  ) {
    throw new Error(`${name} address is not configured.`);
  }
}

// ==================================================
// PROVIDER
// ==================================================

export async function getProvider() {
  if (!window.ethereum) {
    throw new Error("No EVM wallet is connected.");
  }

  return new ethers.BrowserProvider(window.ethereum);
}

// ==================================================
// CONNECT WALLET
// ==================================================

export async function connectWallet() {
  const provider = await getProvider();

  await provider.send("eth_requestAccounts", []);

  return provider.getSigner();
}

// ==================================================
// CONTRACT INSTANCES FOR EXISTING ALLSWAP
// ==================================================

export function getContracts(signer) {
  if (!signer) {
    throw new Error("Connect an EVM wallet first.");
  }

  assertAddress(PILOT_TOKEN_ADDRESS, "PILOT token");
  assertAddress(USDC_TOKEN_ADDRESS, "USDC token");
  assertAddress(SWAP_CONTRACT_ADDRESS, "AllSwap");

  return {
    pilotToken: new ethers.Contract(
      PILOT_TOKEN_ADDRESS,
      PilotTokenABI,
      signer
    ),

    usdcToken: new ethers.Contract(
      USDC_TOKEN_ADDRESS,
      MockUSDCABI,
      signer
    ),

    pilotSwap: new ethers.Contract(
      SWAP_CONTRACT_ADDRESS,
      PilotSwapABI,
      signer
    ),
  };
}

// ==================================================
// GET PILOT AND USDC BALANCES
// Kept for components that still use this function.
// ==================================================

export async function getTokenBalances(provider, account) {
  if (!provider || !account) {
    return {
      PILOT: "0",
      USDC: "0",
    };
  }

  const [pilotToken, usdcToken] = [
    new ethers.Contract(
      PILOT_TOKEN_ADDRESS,
      PilotTokenABI,
      provider
    ),

    new ethers.Contract(
      USDC_TOKEN_ADDRESS,
      MockUSDCABI,
      provider
    ),
  ];

  const [pilotRaw, pilotDecimals, usdcRaw, usdcDecimals] =
    await Promise.all([
      pilotToken.balanceOf(account),
      pilotToken.decimals(),
      usdcToken.balanceOf(account),
      usdcToken.decimals(),
    ]);

  return {
    PILOT: ethers.formatUnits(pilotRaw, pilotDecimals),
    USDC: ethers.formatUnits(usdcRaw, usdcDecimals),
  };
}

// ==================================================
// GET ALL TOKEN BALANCES
// ==================================================

export async function getAllTokenBalances(provider, account) {
  const result = {};

  if (!provider || !account) {
    return result;
  }

  // Native ETH balance
  try {
    const ethRaw = await provider.getBalance(account);

    result.ETH = {
      balance: ethers.formatEther(ethRaw),
      configured: true,
    };
  } catch (error) {
    console.error("Failed to load ETH balance:", error);

    result.ETH = {
      balance: null,
      configured: false,
    };
  }

  // ERC-20 token balances
  const tokenEntries = Object.entries(TOKEN_CONFIG);

  const tokenResults = await Promise.all(
    tokenEntries.map(async ([symbol, token]) => {
      const address = token.address?.trim();

      if (
        !address ||
        !ethers.isAddress(address) ||
        address.toLowerCase() === ZERO_ADDRESS.toLowerCase()
      ) {
        return [
          symbol,
          {
            balance: null,
            configured: false,
          },
        ];
      }

      try {
        const bytecode = await provider.getCode(address);

        if (bytecode === "0x") {
          return [
            symbol,
            {
              balance: null,
              configured: false,
            },
          ];
        }

        const contract = new ethers.Contract(
          address,
          ERC20_ABI,
          provider
        );

        const [rawBalance, decimals] = await Promise.all([
          contract.balanceOf(account),
          contract.decimals(),
        ]);

        return [
          symbol,
          {
            balance: ethers.formatUnits(rawBalance, decimals),
            configured: true,
          },
        ];
      } catch (error) {
        console.error(`Failed to load ${symbol} balance:`, error);

        return [
          symbol,
          {
            balance: null,
            configured: false,
          },
        ];
      }
    })
  );

  for (const [symbol, tokenBalance] of tokenResults) {
    result[symbol] = tokenBalance;
  }

  return result;
}

// ==================================================
// GET SWAP QUOTE
// Existing AllSwap supports only PILOT and USDC.
// ==================================================

export async function getSwapQuote(provider, payToken, amount) {
  if (!provider || !amount || !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0) {
    return "";
  }

  assertAddress(PILOT_TOKEN_ADDRESS, "PILOT token");
  assertAddress(USDC_TOKEN_ADDRESS, "USDC token");
  assertAddress(SWAP_CONTRACT_ADDRESS, "AllSwap");

  const pilotToken = new ethers.Contract(
    PILOT_TOKEN_ADDRESS,
    PilotTokenABI,
    provider
  );

  const usdcToken = new ethers.Contract(
    USDC_TOKEN_ADDRESS,
    MockUSDCABI,
    provider
  );

  const pilotSwap = new ethers.Contract(
    SWAP_CONTRACT_ADDRESS,
    PilotSwapABI,
    provider
  );

  const [pilotDecimals, usdcDecimals, pilotPrice] =
    await Promise.all([
      pilotToken.decimals(),
      usdcToken.decimals(),
      pilotSwap.pilotPrice(),
    ]);

  if (pilotPrice === 0n) {
    throw new Error("Swap price is not configured.");
  }

  if (payToken === "USDC") {
    const inputRaw = ethers.parseUnits(amount, usdcDecimals);
    const outputRaw = inputRaw * pilotPrice;

    return ethers.formatUnits(outputRaw, pilotDecimals);
  }

  if (payToken === "PILOT") {
    const inputRaw = ethers.parseUnits(amount, pilotDecimals);
    const outputRaw = inputRaw / pilotPrice;

    return ethers.formatUnits(outputRaw, usdcDecimals);
  }

  return "";
}

// ==================================================
// READABLE ERRORS
// OpenZeppelin v5 tokens revert with custom errors that are not in the
// contract ABI, which ethers reports as "unknown custom error".
// Decoding them tells the user what actually went wrong.
// ==================================================

const ERC20_ERROR_IFACE = new ethers.Interface([
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
  "error ERC20InvalidSender(address sender)",
  "error ERC20InvalidReceiver(address receiver)",
  "error ERC20InvalidApprover(address approver)",
  "error ERC20InvalidSpender(address spender)",
]);

export function explainSwapError(err) {
  if (err?.isFriendly) return err.message;

  if (
    err?.code === "ACTION_REJECTED" ||
    err?.code === 4001 ||
    /user rejected|user denied/i.test(err?.message || "")
  ) {
    return "You rejected the transaction in your wallet.";
  }

  const data =
    err?.data ||
    err?.info?.error?.data ||
    err?.error?.data ||
    err?.info?.error?.data?.data;

  if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    try {
      const parsed = ERC20_ERROR_IFACE.parseError(data);
      if (parsed) {
        const [first, second, third] = parsed.args;
        switch (parsed.name) {
          case "ERC20InsufficientBalance":
            return `Not enough tokens: ${first} only has ${ethers.formatUnits(
              second,
              18
            )} but ${ethers.formatUnits(third, 18)} is needed. If ${first} is the swap contract, it has no liquidity — send it some of the token you want to receive.`;
          case "ERC20InsufficientAllowance":
            return "The swap contract is not approved to spend this amount. Try again and approve the transaction.";
          default:
            return `Token contract error: ${parsed.name}.`;
        }
      }
    } catch {
      /* not an ERC-20 error – fall through */
    }
  }

  if (/insufficient funds for gas|INSUFFICIENT_FUNDS/i.test(err?.message || "")) {
    return "Not enough ETH in your wallet to pay the network fee.";
  }

  if (/unknown custom error|execution reverted/i.test(err?.message || "")) {
    return "The swap was rejected by the contract. Most often the swap contract does not hold enough of the token you are receiving (add liquidity), or your wallet is on a different network than the deployed contracts.";
  }

  return err?.shortMessage || err?.reason || err?.message || "Swap failed.";
}

const friendly = (message) => {
  const e = new Error(message);
  e.isFriendly = true;
  return e;
};

// ==================================================
// EXECUTE TOKEN SWAP
// Checks everything first so nothing is sent (and no gas or approval is
// wasted) when the swap cannot succeed.
// ==================================================

export async function executeTokenSwap(signer, payToken, amount) {
  try {
    return await runSwap(signer, payToken, amount);
  } catch (err) {
    console.error("Swap failed:", err);
    if (err?.isFriendly) throw err; // keeps extra details such as .liquidity
    throw friendly(explainSwapError(err));
  }
}

/**
 * Sends tokens from the connected wallet to the swap contract so swaps can
 * be paid out. (A plain ERC-20 transfer – the contract has no deposit call.)
 * Sends `wanted` tokens, or as much as the wallet holds if that is less but
 * still covers `needed`.
 */
export async function fundSwapPool(signer, symbol, needed, wanted = "1000") {
  try {
    if (symbol !== "USDC" && symbol !== "PILOT") {
      throw friendly("Only PILOT and USDC can be added to this pool.");
    }
    const { pilotToken, usdcToken } = getContracts(signer);
    const token = symbol === "USDC" ? usdcToken : pilotToken;
    const user = await signer.getAddress();
    const decimals = await token.decimals();
    const bal = await token.balanceOf(user);
    const needRaw = ethers.parseUnits(String(needed), decimals);
    const wantRaw = ethers.parseUnits(String(wanted), decimals);

    if (bal < needRaw) {
      throw friendly(
        `This wallet only has ${ethers.formatUnits(bal, decimals)} ${symbol}, which is not enough to fund the pool. Switch to the wallet account that deployed the contracts (it holds the ${symbol} supply) and try again.`
      );
    }

    const amount = wantRaw > bal ? bal : wantRaw < needRaw ? needRaw : wantRaw;
    const tx = await token.transfer(SWAP_CONTRACT_ADDRESS, amount);
    const receipt = await tx.wait();
    return { receipt, amount: ethers.formatUnits(amount, decimals) };
  } catch (err) {
    console.error("Funding pool failed:", err);
    throw friendly(explainSwapError(err));
  }
}

async function runSwap(signer, payToken, amount) {
  if (!amount || !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0) {
    throw friendly("Enter a valid amount.");
  }

  if (payToken !== "USDC" && payToken !== "PILOT") {
    throw friendly(
      "This token is not supported by the current AllSwap contract."
    );
  }

  const { pilotToken, usdcToken, pilotSwap } = getContracts(signer);
  const provider = signer.provider;
  const user = await signer.getAddress();

  // 1. Contracts must exist on the network the wallet is connected to
  for (const [name, address] of [
    ["PILOT token", PILOT_TOKEN_ADDRESS],
    ["USDC token", USDC_TOKEN_ADDRESS],
    ["Swap contract", SWAP_CONTRACT_ADDRESS],
  ]) {
    if ((await provider.getCode(address)) === "0x") {
      const net = await provider.getNetwork();
      throw friendly(
        `${name} was not found on the network your wallet is using (chain ${net.chainId}). Switch your wallet to the network where the contracts are deployed.`
      );
    }
  }

  const inToken = payToken === "USDC" ? usdcToken : pilotToken;
  const outToken = payToken === "USDC" ? pilotToken : usdcToken;
  const inSymbol = payToken;
  const outSymbol = payToken === "USDC" ? "PILOT" : "USDC";

  const [inDecimals, outDecimals, price] = await Promise.all([
    inToken.decimals(),
    outToken.decimals(),
    pilotSwap.pilotPrice(),
  ]);

  const value = ethers.parseUnits(amount, inDecimals);
  const outRaw = payToken === "USDC" ? value * price : value / price;

  // 2. The user must own enough of the token being paid
  const userBal = await inToken.balanceOf(user);
  if (userBal < value) {
    throw friendly(
      `You only have ${ethers.formatUnits(userBal, inDecimals)} ${inSymbol} but are trying to swap ${amount}.`
    );
  }

  // 3. The swap contract must hold enough of the token being received
  const poolBal = await outToken.balanceOf(SWAP_CONTRACT_ADDRESS);
  if (poolBal < outRaw) {
    const e = friendly(
      `The swap contract only holds ${ethers.formatUnits(poolBal, outDecimals)} ${outSymbol} but needs ${ethers.formatUnits(outRaw, outDecimals)}. Add ${outSymbol} liquidity to the swap contract (${SWAP_CONTRACT_ADDRESS}), or swap a smaller amount.`
    );
    e.liquidity = {
      symbol: outSymbol,
      needed: ethers.formatUnits(outRaw, outDecimals),
    };
    throw e;
  }

  // 4. Approve only when the existing allowance is too low
  const allowance = await inToken.allowance(user, SWAP_CONTRACT_ADDRESS);
  if (allowance < value) {
    const approval = await inToken.approve(SWAP_CONTRACT_ADDRESS, value);
    await approval.wait();
  }

  // 5. Simulate the swap so a revert is caught before the wallet popup
  const fn =
    payToken === "USDC" ? "swapUSDCForPilot" : "swapPilotForUSDC";
  await pilotSwap[fn].staticCall(value);

  const transaction = await pilotSwap[fn](value);
  const receipt = await transaction.wait();

  if (receipt?.status === 0) {
    throw friendly("The swap transaction was mined but failed on-chain.");
  }

  return receipt;
}

// ==================================================
// SEND ANY CONFIGURED ERC-20 TOKEN
// ==================================================

export async function sendToken(
  signer,
  tokenSymbol,
  recipient,
  amount
) {
  if (!signer) {
    throw new Error("Connect an EVM wallet first.");
  }

  if (!ethers.isAddress(recipient)) {
    throw new Error("Invalid recipient wallet address.");
  }

  if (
    !amount ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0
  ) {
    throw new Error("Enter a valid amount.");
  }

  const config = TOKEN_CONFIG[tokenSymbol];

  if (!config) {
    throw new Error(`Unsupported token: ${tokenSymbol}`);
  }

  assertAddress(config.address, `${tokenSymbol} token`);

  const tokenContract = new ethers.Contract(
    config.address,
    ERC20_ABI,
    signer
  );

  const decimals = await tokenContract.decimals();
  const value = ethers.parseUnits(amount, decimals);

  const transaction = await tokenContract.transfer(
    recipient,
    value
  );

  return transaction.wait();
}