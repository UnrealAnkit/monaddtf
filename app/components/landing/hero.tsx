"use client";

import { LaunchAppButton } from "@/components/launch-app-button";
import { FolioMotif } from "@/components/landing/folio-motif";

export function Hero() {
  return (
    <section>
      <div className="relative">
        <h1 className="font-heading mt-8 max-w-3xl text-6xl font-bold leading-[1.02] tracking-tighter">
          ONE DEPOSIT.
          <br />
          THE WHOLE
          <br />
          MONAD BASKET.
        </h1>

        <div className="mt-20 flex flex-wrap justify-between gap-10">
          <div className="max-w-md">
            <LaunchAppButton
              variant="outline"
              className="rounded-full border-2 border-black bg-white/70 px-8 backdrop-blur transition-shadow hover:shadow-[0_0_24px_rgba(31,79,180,0.3)]"
            >
              LAUNCH THE APP
            </LaunchAppButton>
            <p className="mt-8 text-sm leading-relaxed text-gray-700">
              ALLOY IS A SINGLE-DEPOSIT INDEX VAULT ON MONAD.
              <br />
              THREE ECOSYSTEM ASSETS. ONE TOKEN: DEMO.
            </p>
          </div>

          <FolioMotif />
        </div>
      </div>
    </section>
  );
}
