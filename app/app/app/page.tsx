"use client";

// The connected-wallet dashboard: live vault stats, basket composition,
// faucet, mint and redeem — everything the landing page's "Launch App"
// button leads to. One consolidated page rather than separate deposit/
// faucet/pools routes, matching the single-vault demo this contract set
// actually deploys.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/components/app/wallet-provider";
import { DEPOSIT_ASSET, PRICE_DECIMALS, SHARE_DECIMALS, SHARE_SYMBOL, TESTNET_FAUCET_URL } from "@/lib/config";
import {
  approveEntryAsset,
  errorMessage,
  fetchAllowance,
  fetchWalletShareBalance,
  fetchWalletTokenBalance,
  formatUnits,
  fmtUnits,
  parseUnits,
  requestFaucet,
  sendMint,
  sendRedeem,
} from "@/lib/folio";
import { buildBasketRows, buildSlices } from "@/components/landing/data";
import { Donut } from "@/components/landing/donut";
import { useLiveFolio } from "@/hooks/use-live-folio";
import { AppNav } from "@/components/app/app-nav";

export default function AppDashboard() {
  const { address, isConnected, isCorrectNetwork, disconnect, openModal, switchNetwork } = useWallet();
  const { assets, prices, nav, balances } = useLiveFolio();

  const [entryBalance, setEntryBalance] = useState<bigint>(0n);
  const [shareBalance, setShareBalance] = useState<bigint>(0n);
  const [mintAmount, setMintAmount] = useState("100");
  const [redeemAmount, setRedeemAmount] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshWalletBalances = useCallback(async () => {
    if (!address || !isCorrectNetwork) return;
    try {
      const [entryBal, shareBal] = await Promise.all([
        fetchWalletTokenBalance(DEPOSIT_ASSET.address, address),
        fetchWalletShareBalance(address),
      ]);
      setEntryBalance(entryBal);
      setShareBalance(shareBal);
    } catch {
      // Transaction actions surface their own actionable error messages.
    }
  }, [address, isCorrectNetwork]);

  useEffect(() => {
    refreshWalletBalances();
    const t = setInterval(refreshWalletBalances, 8000);
    return () => clearInterval(t);
  }, [refreshWalletBalances]);

  const faucet = async () => {
    if (!address) return;
    setBusy(true);
    setStatus("Requesting entry token from faucet…");
    try {
      await requestFaucet(DEPOSIT_ASSET.address, address, parseUnits("1000", DEPOSIT_ASSET.decimals));
      setStatus(`Faucet sent 1,000 ${DEPOSIT_ASSET.symbol}.`);
      await refreshWalletBalances();
    } catch (err) {
      setStatus("Faucet failed: " + errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleMint = async () => {
    if (!address || !mintAmount) return;
    setBusy(true);
    try {
      const amountWei = parseUnits(mintAmount, DEPOSIT_ASSET.decimals);
      const allowance = await fetchAllowance(address, DEPOSIT_ASSET.address);
      if (allowance < amountWei) {
        setStatus("Approving entry token…");
        await approveEntryAsset(DEPOSIT_ASSET.address, amountWei);
      }
      setStatus("Confirm mint in MetaMask…");
      await sendMint(amountWei, 0n);
      setStatus("Minted successfully.");
      await refreshWalletBalances();
    } catch (err) {
      setStatus("Mint failed: " + errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRedeem = async () => {
    if (!address || !redeemAmount) return;
    setBusy(true);
    try {
      const sharesWei = parseUnits(redeemAmount, SHARE_DECIMALS);
      if (sharesWei <= 0n) throw new Error("Enter a redeem amount greater than zero.");
      if (sharesWei > shareBalance) {
        throw new Error(`You only have ${fmtUnits(shareBalance, SHARE_DECIMALS, 4)} DEMO shares.`);
      }
      setStatus("Confirm redemption in MetaMask…");
      await sendRedeem(sharesWei);
      setStatus("Redeemed successfully.");
      await refreshWalletBalances();
    } catch (err) {
      setStatus("Redeem failed: " + errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] px-6 pb-24 pt-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex space-x-2">
              <div className="h-2 w-2 rounded-full bg-black" />
              <div className="h-2 w-2 rounded-full bg-[#d95b21]" />
            </div>
            <span className="font-heading text-sm font-bold tracking-[0.2em]">ALLOY</span>
          </Link>
          {isConnected ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-gray-500">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
              <Button variant="outline" size="sm" className="rounded-full" onClick={disconnect}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" className="rounded-full bg-black text-white hover:bg-black/85" onClick={() => openModal()}>
              Connect Wallet
            </Button>
          )}
        </header>
        <AppNav />

        {!isConnected ? (
          <Card className="mt-16 flex flex-col items-center gap-4 rounded-3xl border-black/10 p-16 text-center shadow-sm">
            <h1 className="font-heading text-2xl font-bold">Connect a wallet to continue</h1>
            <p className="max-w-sm text-sm text-gray-500">
              Mint and redeem DEMO shares directly against the live Alloy vault on Monad testnet.
            </p>
            <Button className="mt-2 rounded-full bg-black px-8 text-white hover:bg-black/85" onClick={() => openModal()}>
              Connect Wallet
            </Button>
          </Card>
        ) : !isCorrectNetwork ? (
          <Card className="mt-16 flex flex-col items-center gap-4 rounded-3xl border-amber-400/40 bg-amber-50 p-16 text-center shadow-sm">
            <h1 className="font-heading text-2xl font-bold">Wrong network</h1>
            <p className="max-w-sm text-sm text-gray-600">
              Your wallet isn&apos;t on Monad testnet. Switch networks to see live vault data and mint or
              redeem — nothing here will send a transaction on the wrong chain.
            </p>
            <Button
              className="mt-2 rounded-full bg-black px-8 text-white hover:bg-black/85"
              onClick={() => switchNetwork().catch(() => {})}
            >
              Switch to Monad Testnet
            </Button>
          </Card>
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard label="NAV / SHARE" value={nav ? `$${fmtUnits(nav.per_share, PRICE_DECIMALS, 6)}` : "···"} />
              <StatCard label="TOTAL VALUE LOCKED" value={nav ? `$${fmtUnits(nav.total_value, PRICE_DECIMALS, 2)}` : "···"} />
              <StatCard label="YOUR SHARES" value={`${fmtUnits(shareBalance, SHARE_DECIMALS, 4)} ${SHARE_SYMBOL}`} />
            </section>

            {!nav && (
              <Card className="mt-6 rounded-2xl border-[#d95b21]/30 bg-[#fff7f2] px-6 py-4 text-sm text-[#b34d1d]">
                Live NAV is temporarily unavailable from the Monad testnet oracle/RPC. Asset balances and
                redemption remain readable; refresh shortly to restore NAV and prices.
              </Card>
            )}

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <Card className="rounded-3xl border-black/10 p-8 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-heading text-sm font-bold tracking-widest">BASKET COMPOSITION</h3>
                  <span className="text-[11px] text-gray-400">TARGET · HELD</span>
                </div>
                <div className="flex justify-center">
                  <Donut slices={buildSlices(assets)} active={null} />
                </div>
                <div className="mt-6 space-y-3">
                  {buildBasketRows(assets, prices, balances).map((row) => (
                    <div key={row.symbol} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                        {row.symbol}
                      </span>
                      <span className="flex items-center gap-3 tabular-nums text-gray-500">
                        <span>{row.price}</span>
                        <span className="text-[#1f4fb4]">{row.weight.toFixed(0)}%</span>
                        <span className="min-w-[4.5rem] text-right text-gray-700">{row.held}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex flex-col gap-6">
                <Card className="rounded-3xl border-black/10 p-6 shadow-sm">
                  <h3 className="font-heading text-sm font-bold tracking-widest">MINT</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Your {DEPOSIT_ASSET.symbol} balance: {fmtUnits(entryBalance, DEPOSIT_ASSET.decimals, 4)}
                  </p>
                  <button
                    onClick={faucet}
                    disabled={busy}
                    className="mt-2 self-start text-xs font-medium text-[#1f4fb4] underline underline-offset-2 disabled:opacity-50"
                  >
                    Get test {DEPOSIT_ASSET.symbol} from faucet
                  </button>
                  {TESTNET_FAUCET_URL && (
                    <p className="mt-2 text-xs leading-relaxed text-gray-500">
                      New wallet? You also need a little testnet MON for gas. {" "}
                      <a
                        href={TESTNET_FAUCET_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#1f4fb4] underline underline-offset-2"
                      >
                        Get testnet MON
                      </a>
                    </p>
                  )}
                  <Input
                    className="mt-4"
                    type="number"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    placeholder="Amount to deposit"
                  />
                  <Button className="mt-3 w-full rounded-full bg-black text-white hover:bg-black/85" onClick={handleMint} disabled={busy}>
                    Deposit &amp; Mint
                  </Button>
                </Card>

                <Card className="rounded-3xl border-black/10 p-6 shadow-sm">
                  <h3 className="font-heading text-sm font-bold tracking-widest">REDEEM</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Your {SHARE_SYMBOL} balance: {fmtUnits(shareBalance, SHARE_DECIMALS, 4)}
                  </p>
                  <Input
                    className="mt-4"
                    type="number"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    placeholder="Shares to redeem"
                  />
                  <button
                    type="button"
                    onClick={() => setRedeemAmount(formatUnits(shareBalance, SHARE_DECIMALS))}
                    disabled={busy || shareBalance === 0n}
                    className="mt-2 text-xs font-medium text-[#1f4fb4] underline underline-offset-2 disabled:opacity-50"
                  >
                    Use max balance
                  </button>
                  <Button
                    variant="outline"
                    className="mt-3 w-full rounded-full border-2 border-black"
                    onClick={handleRedeem}
                    disabled={busy || !redeemAmount || (() => {
                      try {
                        return parseUnits(redeemAmount, SHARE_DECIMALS) > shareBalance;
                      } catch {
                        return true;
                      }
                    })()}
                  >
                    Redeem for basket assets
                  </Button>
                </Card>
              </div>
            </section>
          </>
        )}

        {status && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-black/10 bg-white px-5 py-2.5 text-xs shadow-lg">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-black/10 p-6 shadow-sm">
      <div className="text-[11px] tracking-[0.2em] text-gray-500">{label}</div>
      <div className="font-heading mt-3 text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  );
}
