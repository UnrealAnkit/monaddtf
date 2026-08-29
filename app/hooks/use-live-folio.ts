"use client";

// Live chain data for the landing page — same read-only client the app uses.
// Fetches assets, NAV, supply, vault holdings and per-asset prices on mount;
// nav + prices + balances refresh every 15s. Degrades to null/[] if the chain
// (or oracle) is unreachable.

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/components/app/wallet-provider";
import {
  AssetInfo,
  NavInfo,
  PriceData,
  fetchAssetPrices,
  fetchAssets,
  fetchBalances,
  fetchNav,
  fetchTotalSupply,
} from "@/lib/folio";

export function useLiveFolio() {
  // Re-read after MetaMask switches networks; otherwise a page opened on the
  // wrong chain can stay stuck with empty or stale values.
  const { chainId } = useWallet();
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData | null>>({});
  const [nav, setNav] = useState<NavInfo | null>(null);
  const [supply, setSupply] = useState<bigint | null>(null);
  const [balances, setBalances] = useState<bigint[] | null>(null);
  const tokensRef = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await fetchAssets();
        if (!alive) return;
        setAssets(a);
        tokensRef.current = a.map((x) => x.token);
        const [n, s, b, p] = await Promise.all([
          fetchNav().catch(() => null),
          fetchTotalSupply().catch(() => null),
          fetchBalances(tokensRef.current).catch(() => null),
          fetchAssetPrices(tokensRef.current).catch(() => ({}) as Record<string, PriceData | null>),
        ]);
        if (!alive) return;
        setNav(n);
        setSupply(s);
        setBalances(b);
        setPrices(p);
      } catch {
        /* chain unreachable — static fallbacks render */
      }
    })();
    const t = setInterval(() => {
      if (!alive) return;
      fetchNav().then((n) => alive && setNav(n)).catch(() => {});
      if (tokensRef.current.length) {
        fetchBalances(tokensRef.current).then((b) => alive && setBalances(b)).catch(() => {});
        fetchAssetPrices(tokensRef.current).then((p) => alive && setPrices(p)).catch(() => {});
      }
    }, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [chainId]);

  return { assets, prices, nav, supply, balances };
}
