import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeliumTrader — AI-Powered Algorithmic Crypto Trading",
  description:
    "Democratizing algorithmic crypto trading. Parameter-tuned strategies, backtesting simulation, paper trading on Sui DeepBook, and AI-powered insights — all on-chain, transparent, and accessible.",
  keywords: [
    "algorithmic trading",
    "crypto trading",
    "DeFi",
    "Sui blockchain",
    "DeepBook",
    "trading bot",
    "backtesting",
    "paper trading",
    "AI trading",
  ],
  openGraph: {
    title: "HeliumTrader — AI-Powered Algorithmic Crypto Trading",
    description:
      "Parameter-tuned trading strategies with simulation, paper trading on Sui, and AI reports.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
