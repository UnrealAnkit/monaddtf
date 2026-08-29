// Landing footer: wordmark, protocol tagline, docs + app links.

import Link from "next/link";
import { LaunchAppButton } from "@/components/launch-app-button";
import { EXPLORER_URL, VAULT_ADDRESS } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-black/5 px-6 py-8">
      <div className="flex flex-col items-center justify-between gap-4 text-xs tracking-wide text-gray-500 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="flex space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#d95b21]" />
          </div>
          <span className="font-heading font-bold tracking-[0.2em] text-black">ALLOY</span>
        </div>
        <p className="text-center">REDEMPTION IS NEVER PAUSABLE</p>
        <div className="flex items-center gap-6">
          <Link href="/about" className="font-medium text-gray-600 transition-colors hover:text-black hover:underline">
            ABOUT
          </Link>
          {EXPLORER_URL && (
            <a
              href={`${EXPLORER_URL}/address/${VAULT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-600 transition-colors hover:text-black hover:underline"
            >
              EXPLORER
            </a>
          )}
          <LaunchAppButton plain className="cursor-pointer font-medium text-gray-600 hover:text-black hover:underline">
            LAUNCH APP →
          </LaunchAppButton>
        </div>
      </div>
    </footer>
  );
}
