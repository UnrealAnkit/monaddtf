import type { Metadata } from "next";
import "./globals.css";
import { SmoothScroll } from "@/components/smooth-scroll";
import { WalletProvider } from "@/components/app/wallet-provider";
import { ConnectWalletModal } from "@/components/app/connect-wallet-modal";
import { Inter, Space_Grotesk, Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alloy — Monad Index Vault",
  description:
    "One deposit, the whole Monad basket. A single-deposit index vault on Monad testnet — three ecosystem assets, one token: DEMO.",
  openGraph: {
    title: "Alloy — Monad Index Vault",
    description:
      "One deposit, the whole Monad basket. A single-deposit index vault on Monad testnet — three ecosystem assets, one token: DEMO.",
    siteName: "Alloy — Monad Index Vault",
    images: [
      {
        url: "/landingpage.png",
        width: 1200,
        height: 630,
        alt: "Alloy — Monad Index Vault",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alloy — Monad Index Vault",
    description:
      "One deposit, the whole Monad basket. A single-deposit index vault on Monad testnet — three ecosystem assets, one token: DEMO.",
    images: ["/landingpage.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable, spaceGrotesk.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <WalletProvider>
          <SmoothScroll>{children}</SmoothScroll>
          <ConnectWalletModal />
        </WalletProvider>
      </body>
    </html>
  );
}
