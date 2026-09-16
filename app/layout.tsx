import type { Metadata } from "next";
import { VT323, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vlad — Skatehive Pro Shape",
  description:
    "A six-ply maple deck, cast trucks and the full hardware stack — built by Skatehive. Scroll to see it come apart.",
  openGraph: {
    title: "Vlad — Skatehive Pro Shape",
    description:
      "A six-ply maple deck, cast trucks and the full hardware stack — built by Skatehive.",
    url: "https://vlad.skatehive.app",
    siteName: "Skatehive",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${vt323.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
