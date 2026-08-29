// About Alloy: what it is, the problem it solves, and an FAQ. A standalone,
// self-contained route — no live contract reads, just an explainer anyone
// landing here can read regardless of wallet or network state.

import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { SectionLabel } from "@/components/landing/section-label";
import { LaunchAppButton } from "@/components/launch-app-button";

const FAQ = [
  {
    q: "Do I need to hold all three basket tokens myself?",
    a: "No — that's the whole point. Deposit one asset (mMON) and the vault sources the rest for you in the same transaction, so a single deposit gives you exposure to the entire basket.",
  },
  {
    q: "Is this real money?",
    a: "No. Alloy runs on Monad testnet. Every token involved — including the deposit asset — is free from the built-in faucet and carries no monetary value, so it's a safe place to try the full mint/redeem flow.",
  },
  {
    q: "Can my funds get locked?",
    a: "Redemption is never pausable. You can always burn your DEMO shares to receive your pro-rata slice of the underlying tokens back, regardless of any other state the contract is in — a guardian can only pause new minting.",
  },
  {
    q: "What is DEMO?",
    a: "DEMO is the vault's share token. Holding it represents a proportional claim on everything the basket holds; its value tracks the vault's net asset value.",
  },
  {
    q: "How are prices decided?",
    a: "Prices come from an on-chain OracleRouter with a staleness guard — Monad has live feeds from Pyth, Chainlink, Chronicle, Supra and Switchboard. If a feed goes stale, the vault refuses to serve a value rather than acting on bad data.",
  },
  {
    q: "Why build this on Monad instead of Ethereum?",
    a: "Because the mechanism only makes sense if minting is cheap and fast. Monad's ~1s blocks and sub-cent gas make an atomic swap-into-several-assets-and-mint transaction practical for everyday deposit sizes, not just whales — the same design on Ethereum mainnet would price out most depositors in gas alone.",
  },
  {
    q: "What's mocked right now vs. genuinely real?",
    a: "Real: the chain (Monad testnet), the deployed contract bytecode, and every transaction the vault executes. Mocked: the basket assets (mGOV/mLSMON/mUSD/mMON) are self-issued test tokens standing in for real Monad ecosystem assets, since there's no real market to price or swap them against yet. Swapping in a real basket is a configuration change, not a contract change.",
  },
  {
    q: "Is this audited?",
    a: "No. This is unaudited hackathon software built for a Monad hackathon — don't point it at anything but testnet funds.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />
      <div className="h-20" aria-hidden="true" />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <SectionLabel>ABOUT</SectionLabel>

        <h1 className="font-heading mt-6 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          One deposit. A whole ecosystem basket.
        </h1>

        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-gray-700">
          <p>
            <strong className="font-semibold text-black">What I&apos;m building:</strong> Alloy is a
            single-deposit index vault on Monad — one ERC20 share token, DEMO, backed by a fixed-weight
            basket of Monad ecosystem assets. Deposit a single entry asset and the vault splits and swaps
            it across the whole basket atomically, in one transaction, minting shares proportional to the
            USD value added. Redeem any time for a pro-rata slice of every asset the vault holds — that
            exit path can never be paused, no matter what else is happening to the contract.
          </p>

          <p>
            <strong className="font-semibold text-black">The problem it solves:</strong> getting
            diversified exposure to a fast-growing chain&apos;s ecosystem today means either picking
            individual tokens yourself — research overhead, no rebalancing, you end up over-indexed on
            whatever you bought first — or trusting a centralized index product, with the custody risk
            and opaque rebalancing that comes with it. A fully on-chain basket avoids both, but on most
            chains it&apos;s a bad trade: every deposit needs several swaps plus an oracle read, and on a
            slow or expensive chain that&apos;s either too costly for a small depositor or too slow to
            execute atomically before prices move. Monad&apos;s ~1s blocks and sub-cent gas make that
            swap-and-mint sequence cheap enough to be practical for everyday deposit sizes, not just
            whales — which is the whole reason this is worth building here specifically, rather than
            being one more index contract redeployed on whichever chain has the cheapest gas that week.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <LaunchAppButton className="rounded-full bg-black px-8 text-white hover:bg-black/85">
            Launch the app
          </LaunchAppButton>
        </div>

        <div className="mt-20">
          <SectionLabel>FAQ</SectionLabel>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl border border-black/10 bg-white px-5 py-4 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading text-sm font-semibold text-black">
                  {f.q}
                  <span className="shrink-0 text-lg text-gray-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
