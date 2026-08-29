// Shared landing-page data: static basket fallback (instant paint before chain
// data lands) and builders that shape live chain data for each section.

import { ASSETS, PRICE_DECIMALS, TOKEN_INFO } from "@/lib/config";
import { fmtUnits, toBig } from "@/lib/folio";
import type { AssetInfo, PriceData } from "@/lib/folio";

/** Human-friendly holdings amount, e.g. 1.24M / 12.3K / 60.00. */
function compactUnits(v: bigint, decimals: number): string {
  const whole = Number(toBig(v) / 10n ** BigInt(decimals));
  if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(2)}M`;
  if (whole >= 1_000) return `${(whole / 1_000).toFixed(1)}K`;
  return fmtUnits(v, decimals, 2);
}

// Palette carried over from the original folio artwork: sky blue,
// international orange, cloud cream.
export const PRIMARY = "#1f4fb4";
export const SECONDARY = "#d95b21";
export const CREAM = "#f3e6c5";

export const BASKET_FALLBACK = ASSETS.map((asset) => ({
  symbol: asset.symbol,
  weight_bps: asset.targetWeightBps,
  color: asset.color,
  simulated: asset.simulated,
}));

export function tokenSymbol(address: string): string {
  return TOKEN_INFO[address]?.symbol ?? `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export interface Slice {
  color: string;
  frac: number;
}

export interface TickerItem {
  symbol: string;
  color: string;
  price: string | null; // null when the oracle feed is stale/reverting
  weight: string;
  held: string | null; // vault's on-chain holdings (oracle-independent)
}

export interface BasketRow {
  symbol: string;
  color: string;
  weight: number;
  price: string;
  held: string;
  simulated?: boolean;
}

type Prices = Record<string, PriceData | null>;

export function buildSlices(assets: AssetInfo[]): Slice[] {
  return assets.length
    ? assets.map((a) => ({ color: TOKEN_INFO[a.token]?.color ?? "#888", frac: a.weight_bps / 10_000 }))
    : BASKET_FALLBACK.map((b) => ({ color: b.color, frac: b.weight_bps / 10_000 }));
}

export function buildTickerItems(
  assets: AssetInfo[],
  prices: Prices,
  balances: bigint[] | null,
): TickerItem[] {
  return assets.length
    ? assets.map((a, i) => ({
        symbol: tokenSymbol(a.token),
        color: TOKEN_INFO[a.token]?.color ?? "#888",
        price: prices[a.token] ? `$${fmtUnits(prices[a.token]!.price, PRICE_DECIMALS, 4)}` : null,
        weight: `${(a.weight_bps / 100).toFixed(0)}%`,
        held: balances && balances[i] !== undefined ? compactUnits(balances[i], a.decimals) : null,
      }))
    : BASKET_FALLBACK.map((b) => ({
        symbol: b.symbol,
        color: b.color,
        price: null,
        weight: `${b.weight_bps / 100}%`,
        held: null,
      }));
}

export function buildBasketRows(assets: AssetInfo[], prices: Prices, balances: bigint[] | null = null): BasketRow[] {
  return assets.length
    ? assets.map((a, i) => ({
        symbol: tokenSymbol(a.token),
        color: TOKEN_INFO[a.token]?.color ?? "#888",
        weight: a.weight_bps / 100,
        price: prices[a.token] ? `$${fmtUnits(prices[a.token]!.price, PRICE_DECIMALS, 6)}` : "···",
        held: balances?.[i] !== undefined ? fmtUnits(balances[i], a.decimals, 4) : "···",
        simulated: TOKEN_INFO[a.token]?.simulated,
      }))
    : BASKET_FALLBACK.map((b) => ({
        symbol: b.symbol,
        color: b.color,
        weight: b.weight_bps / 100,
        price: "···",
        held: "···",
        simulated: b.simulated,
      }));
}
