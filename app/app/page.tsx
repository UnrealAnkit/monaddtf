"use client";

// Landing page — thin composition; each section lives in components/landing/.

import { useEffect, useState } from "react";
import { BasketSection } from "@/components/landing/basket";
import { Cta } from "@/components/landing/cta";
import { buildBasketRows, buildSlices, buildTickerItems } from "@/components/landing/data";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Navbar } from "@/components/landing/navbar";
import { Stats } from "@/components/landing/stats";
import { Ticker } from "@/components/landing/ticker";
import { useLiveFolio } from "@/hooks/use-live-folio";

export default function Home() {
  const { assets, prices, nav, supply, balances } = useLiveFolio();
  const [motifVisible, setMotifVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMotifVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#f8f8f8]">
      <img
        src="/landing.png"
        alt=""
        aria-hidden="true"
        style={{
          opacity: motifVisible ? 1 : 0,
          transform: motifVisible ? "translate(0, 0) scale(1)" : "translate(48px, -28px) scale(1.06)",
          transition: "opacity 1.2s cubic-bezier(0.16,1,0.3,1) 0.1s, transform 1.2s cubic-bezier(0.16,1,0.3,1) 0.1s",
        }}
        className="pointer-events-none absolute right-0 top-0 z-0 w-[min(45vw,580px)] select-none"
      />

      <Navbar />
      <div className="h-20" aria-hidden="true" />

      <main className="relative z-10 px-6 pb-24 pt-8 ">
        <Hero />

        <div className="relative">
          <Stats nav={nav} supply={supply} />
          <Ticker items={buildTickerItems(assets, prices, balances)} />
          <BasketSection slices={buildSlices(assets)} rows={buildBasketRows(assets, prices, balances)} />
          <HowItWorks />
          <Features />
          <Cta />
        </div>
      </main>

      <Footer />
    </div>
  );
}
