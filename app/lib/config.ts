// Network + basket configuration. Selects one deployment manifest (checked-in
// JSON produced by `npm run deploy:local` / `deploy:testnet` in the contracts
// package) based on NEXT_PUBLIC_ALLOY_NETWORK. Default is testnet so the
// production build points at the real, live Monad testnet deployment.

import localhost from "./deployments/localhost.json";
import monadTestnet from "./deployments/monadTestnet.json";

export type AlloyNetwork = "testnet" | "localhost";

export interface AssetConfig {
  id: string;
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  targetWeightBps: number;
  color: string;
  simulated?: boolean;
  faucetAmount?: string;
}

interface DeploymentManifest {
  network: string;
  chainId: number;
  demoVault: string;
  oracleRouter: string;
  swapRouter: string;
  entryToken: { symbol: string; address: string };
  assets: { symbol: string; address: string; weightBps: number }[];
}

// Visual identity for each basket asset — decorative only, keyed by symbol so
// it survives redeployments (addresses change, symbols don't).
const ASSET_STYLE: Record<string, { name: string; color: string; simulated?: boolean }> = {
  mMON: { name: "Mock Wrapped MON", color: "#7b68ee" },
  mGOV: { name: "Mock DEX Governance Token", color: "#9f4ef5" },
  mLSMON: { name: "Mock Liquid Staked MON", color: "#f5a623", simulated: true },
  mUSD: { name: "Mock USD Stable", color: "#2775ca" },
};

const NETWORK: AlloyNetwork = (process.env.NEXT_PUBLIC_ALLOY_NETWORK as AlloyNetwork) ?? "testnet";

const manifest: DeploymentManifest = NETWORK === "localhost" ? localhost : monadTestnet;

export const CHAIN_ID = manifest.chainId;
export const VAULT_ADDRESS = manifest.demoVault;
export const ORACLE_ROUTER_ADDRESS = manifest.oracleRouter;

export const RPC_URL =
  NETWORK === "localhost"
    ? (process.env.NEXT_PUBLIC_LOCAL_RPC_URL ?? "http://127.0.0.1:8545")
    : (process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC ?? "https://testnet-rpc.monad.xyz");

export const EXPLORER_URL = NETWORK === "localhost" ? "" : "https://testnet.monadexplorer.com";
export const TESTNET_FAUCET_URL = NETWORK === "localhost" ? "" : "https://faucet.monad.xyz";

export const DEPOSIT_ASSET: AssetConfig = {
  id: "deposit",
  name: ASSET_STYLE[manifest.entryToken.symbol]?.name ?? manifest.entryToken.symbol,
  symbol: manifest.entryToken.symbol,
  address: manifest.entryToken.address,
  decimals: 18,
  targetWeightBps: 0,
  color: ASSET_STYLE[manifest.entryToken.symbol]?.color ?? "#7b68ee",
  faucetAmount: "1000",
};

export const ASSETS: AssetConfig[] = manifest.assets.map((a) => ({
  id: a.symbol.toLowerCase(),
  name: ASSET_STYLE[a.symbol]?.name ?? a.symbol,
  symbol: a.symbol,
  address: a.address,
  decimals: 18,
  targetWeightBps: a.weightBps,
  color: ASSET_STYLE[a.symbol]?.color ?? "#888",
  simulated: ASSET_STYLE[a.symbol]?.simulated,
}));

export const ASSET_BY_ADDRESS: Record<string, AssetConfig> = Object.fromEntries(
  ASSETS.map((a) => [a.address.toLowerCase(), a]),
);

export const TOKEN_INFO: Record<string, { name: string; symbol: string; color: string; simulated?: boolean }> =
  Object.fromEntries(ASSETS.map((a) => [a.address, { name: a.name, symbol: a.symbol, color: a.color, simulated: a.simulated }]));

export const SHARE_SYMBOL = "DEMO";
export const SHARE_DECIMALS = 18;
export const PRICE_DECIMALS = 18;
export const ALLOY_NETWORK = NETWORK;
