// Three-step onboarding cards with hover lift and glow.

import { Reveal } from "@/components/landing/reveal";
import { SectionLabel } from "@/components/landing/section-label";

const STEPS = [
  {
    n: "01",
    title: "CONNECT",
    body: "Connect an EVM wallet on Monad testnet. The built-in faucet drips test mMON in one click.",
  },
  {
    n: "02",
    title: "DEPOSIT",
    body: "Deposit mMON once and the contract swaps it across the basket tokens, minting DEMO straight to your wallet.",
  },
  {
    n: "03",
    title: "HOLD & REDEEM",
    body: "DEMO tracks live NAV from on-chain oracle prices. Redeem for the underlying assets any time you like.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mt-28 scroll-mt-28">
      <Reveal>
        <SectionLabel>HOW IT WORKS</SectionLabel>
      </Reveal>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 120}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-black/10 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:border-[#1f4fb4]/50 hover:shadow-lg">
              <div className="font-heading text-4xl font-bold text-[#d95b21]">{s.n}</div>
              <h3 className="font-heading mt-4 text-sm font-bold tracking-widest">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{s.body}</p>
              <div
                className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full bg-[#1f4fb4]/0 blur-3xl transition group-hover:bg-[#1f4fb4]/15"
                aria-hidden="true"
              />
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
