"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["Folio", "/app"],
  ["Deposit", "/app/deposit"],
  ["Faucet", "/app/faucet"],
  ["Pools", "/app/pools"],
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Monad app sections" className="mt-5 flex w-full max-w-2xl rounded-full border border-black/10 bg-white p-1 shadow-sm">
      {LINKS.map(([label, href]) => {
        const active = href === "/app" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition ${
              active ? "bg-[#1f4fb4] text-white shadow-sm" : "text-gray-600 hover:bg-black/5 hover:text-black"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
