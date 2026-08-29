// Chain client for the vault. Filename kept as `folio.ts` (rather than
// `vault.ts`) purely so every import path below matches the landing
// components this file was ported alongside — nothing here is Stellar/Soroban
// specific. Read calls go through a plain JSON-RPC provider (no wallet
// needed); writes go through the connected browser wallet's signer.

import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits as ethersParseUnits } from "ethers";
import { ERC20_ABI, INDEX_VAULT_ABI, ORACLE_ROUTER_ABI } from "@/lib/abi";
import { ASSETS, CHAIN_ID, EXPLORER_URL, ORACLE_ROUTER_ADDRESS, RPC_URL, VAULT_ADDRESS } from "@/lib/config";

export interface AssetInfo {
  token: string;
  weight_bps: number;
  decimals: number;
}
export interface NavInfo {
  total_value: bigint;
  per_share: bigint;
}
export interface PriceData {
  price: bigint;
  timestamp: bigint;
}

export function errorMessage(error: unknown): string {
  const raw =
    error && typeof error === "object" && "shortMessage" in error
      ? String((error as { shortMessage?: unknown }).shortMessage ?? "")
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  if (raw.toLowerCase().includes("could not coalesce error")) {
    return "Your wallet RPC did not respond. Confirm Monad Testnet is selected, then retry in a moment.";
  }
  if (error && typeof error === "object" && "shortMessage" in error) {
    return raw || "contract call reverted";
  }
  return raw || "contract call reverted";
}

let readProvider: JsonRpcProvider | BrowserProvider | undefined;
function getReadProvider(): JsonRpcProvider | BrowserProvider {
  // Prefer the wallet's provider when it is present. This keeps the dashboard
  // on the same Monad endpoint that successfully signs writes and avoids a
  // separate public-RPC/CORS failure making live values disappear.
  const injected = ethProvider();
  if (injected) {
    if (!(readProvider instanceof BrowserProvider)) readProvider = new BrowserProvider(injected);
    return readProvider;
  }
  // Do not start ethers' background network-detection loop in the browser. The
  // chain is fixed by the selected deployment manifest; this also prevents a
  // transient public-RPC failure from surfacing as an unhandled rejection.
  if (!readProvider) readProvider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
  return readProvider;
}

function vaultRead() {
  return new Contract(VAULT_ADDRESS, INDEX_VAULT_ABI, getReadProvider());
}
function oracleRead() {
  return new Contract(ORACLE_ROUTER_ADDRESS, ORACLE_ROUTER_ABI, getReadProvider());
}
function erc20Read(address: string) {
  return new Contract(address, ERC20_ABI, getReadProvider());
}

// --- wallet ---

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

function ethProvider(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
}

export async function isWalletAvailable(): Promise<boolean> {
  return !!ethProvider();
}

const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

/** Prompt the wallet to switch to (or add, if unknown) the Alloy network. */
export async function ensureAlloyNetwork(): Promise<void> {
  const eth = ethProvider();
  if (!eth) throw new Error("No wallet extension found");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err; // 4902 = chain not added yet
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_ID_HEX,
          chainName: "Monad Testnet",
          nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: EXPLORER_URL ? [EXPLORER_URL] : [],
        },
      ],
    });
  }
}

/** Current chain the wallet is connected to, or null if no wallet/unavailable. */
export async function getCurrentChainId(): Promise<number | null> {
  const eth = ethProvider();
  if (!eth) return null;
  try {
    const hex = (await eth.request({ method: "eth_chainId" })) as string;
    return parseInt(hex, 16);
  } catch {
    return null;
  }
}

export async function connectWallet(): Promise<string> {
  const eth = ethProvider();
  if (!eth) throw new Error("No wallet extension found. Install MetaMask or another EVM wallet.");
  const provider = new BrowserProvider(eth);
  const accounts: string[] = await provider.send("eth_requestAccounts", []);
  if (!accounts[0]) throw new Error("No account returned by wallet");
  // Best-effort: prompt the network switch right away so the wallet doesn't
  // sit on whatever chain it happened to be on (e.g. Ethereum Mainnet).
  // Not fatal if the user dismisses it here — every write call below
  // independently re-checks and re-prompts before it will send a transaction.
  await ensureAlloyNetwork().catch(() => {});
  return accounts[0];
}

/** Silent re-connect for page reloads: never opens a wallet popup. */
export async function reconnectWallet(): Promise<string | null> {
  const eth = ethProvider();
  if (!eth) return null;
  try {
    const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Signer for write calls, hard-guarded against the wrong network. Every mint/
 * redeem/approve/faucet call goes through this, so none of them can silently
 * fire a transaction against Ethereum Mainnet or any other chain the wallet
 * happens to be on — exactly the bug that let an `approve` go out while
 * MetaMask was still set to Ethereum.
 */
async function getSigner() {
  const eth = ethProvider();
  if (!eth) throw new Error("No wallet extension found");

  const currentChainId = await getCurrentChainId();
  if (currentChainId !== CHAIN_ID) {
    await ensureAlloyNetwork();
    const rechecked = await getCurrentChainId();
    if (rechecked !== CHAIN_ID) {
      throw new Error(`Wrong network — switch your wallet to Monad Testnet (chain ${CHAIN_ID}) and try again.`);
    }
  }

  const provider = new BrowserProvider(eth);
  return provider.getSigner();
}

// --- reads ---

export async function fetchAssets(): Promise<AssetInfo[]> {
  const v = vaultRead();
  const n: bigint = await v.basketLength();
  const count = Number(n);
  const rows = await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const [token, weightBps] = await Promise.all([v.assets(i), v.targetWeightsBps(i)]);
      const decimals: number = await erc20Read(token).decimals();
      return { token, weight_bps: Number(weightBps), decimals: Number(decimals) };
    }),
  );
  return rows;
}

export async function fetchNav(): Promise<NavInfo> {
  const v = vaultRead();
  const [perShare, totalValue] = await Promise.all([v.navPerShare(), v.totalValueUSD()]);
  return { total_value: totalValue, per_share: perShare };
}

export async function fetchBalances(tokens?: string[]): Promise<bigint[]> {
  const list = tokens ?? ASSETS.map((a) => a.address);
  return Promise.all(list.map((addr) => erc20Read(addr).balanceOf(VAULT_ADDRESS)));
}

export async function fetchShareBalance(account: string): Promise<bigint> {
  return vaultRead().balanceOf(account);
}

/** Wallet-scoped balance reads used immediately around a transaction. Keeping
 * these on the injected provider means the app remains usable when a public
 * RPC has temporary CORS or availability issues. */
export async function fetchWalletTokenBalance(tokenAddress: string, account: string): Promise<bigint> {
  const signer = await getSigner();
  return new Contract(tokenAddress, ERC20_ABI, signer).balanceOf(account);
}

export async function fetchWalletShareBalance(account: string): Promise<bigint> {
  const signer = await getSigner();
  return new Contract(VAULT_ADDRESS, INDEX_VAULT_ABI, signer).balanceOf(account);
}

export async function fetchTotalSupply(): Promise<bigint> {
  return vaultRead().totalSupply();
}

export async function fetchAssetPrices(tokens: string[]): Promise<Record<string, PriceData | null>> {
  const oracle = oracleRead();
  const entries = await Promise.all(
    tokens.map(async (token) => {
      try {
        const [price, updatedAt] = await oracle.getPriceUSD(token);
        return [token, { price, timestamp: updatedAt }] as const;
      } catch {
        return [token, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

// --- writes ---

export async function fetchAllowance(owner: string, tokenAddress: string): Promise<bigint> {
  // This happens immediately before a write. Read through the connected wallet
  // instead of the public dashboard RPC so a temporary public-RPC outage cannot
  // prevent an otherwise healthy wallet from opening its approval transaction.
  const signer = await getSigner();
  return new Contract(tokenAddress, ERC20_ABI, signer).allowance(owner, VAULT_ADDRESS);
}

export async function approveEntryAsset(tokenAddress: string, amount: bigint): Promise<void> {
  const signer = await getSigner();
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const tx = await token.approve(VAULT_ADDRESS, amount);
  await tx.wait();
}

/** Deposit `amountIn` of the entry asset; the vault splits + swaps into the
 * basket and mints shares. `minSharesOut` guards against slippage. */
export async function sendMint(amountIn: bigint, minSharesOut = 0n): Promise<bigint> {
  const signer = await getSigner();
  const vault = new Contract(VAULT_ADDRESS, INDEX_VAULT_ABI, signer);
  const tx = await vault.mint(amountIn, minSharesOut);
  const receipt = await tx.wait();
  const mintedEvent = receipt.logs
    .map((log: { topics: ReadonlyArray<string>; data: string }) => {
      try {
        return vault.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e: { name?: string } | null) => e?.name === "Minted");
  return mintedEvent ? (mintedEvent.args.sharesOut as bigint) : 0n;
}

export async function sendRedeem(shares: bigint): Promise<bigint[]> {
  const signer = await getSigner();
  const vault = new Contract(VAULT_ADDRESS, INDEX_VAULT_ABI, signer);
  const tx = await vault.redeem(shares);
  const receipt = await tx.wait();
  const redeemedEvent = receipt.logs
    .map((log: { topics: ReadonlyArray<string>; data: string }) => {
      try {
        return vault.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e: { name?: string } | null) => e?.name === "Redeemed");
  return redeemedEvent ? (redeemedEvent.args.amountsOut as bigint[]) : [];
}

/** Testnet/local only — mints free entry-asset tokens to `account`. */
export async function requestFaucet(tokenAddress: string, account: string, amount: bigint): Promise<void> {
  const signer = await getSigner();
  const token = new Contract(tokenAddress, ERC20_ABI, signer);
  const tx = await token.mint(account, amount);
  await tx.wait();
}

// --- formatting ---

export function toBig(v: bigint | number | string): bigint {
  return typeof v === "bigint" ? v : BigInt(v);
}

export function fmtUnits(v: bigint | number | string, decimals: number, dp = 4): string {
  const val = typeof v === "bigint" ? v : BigInt(v);
  const base = 10n ** BigInt(decimals);
  const whole = val / base;
  const frac = (val < 0n ? -val : val) % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, dp);
  return `${whole.toString()}.${fracStr}`;
}

export function parseUnits(s: string, decimals: number): bigint {
  const trimmed = s.trim() || "0";
  return ethersParseUnits(trimmed, decimals);
}

export { formatUnits };
