import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoSettle AI — Autonomous PayPal Dispute Resolution & Evidence Orchestration",
  description:
    "Turn stressful, time-sensitive PayPal disputes into evidence-backed, factual response packages submitted through PayPal Disputes API in minutes. Built for the PayPal AI Hackathon.",
  keywords: [
    "PayPal Disputes API",
    "Dispute Automation",
    "AI Merchant Defense",
    "Chargeback Resolution",
    "Seller Protection",
    "AutoSettle AI",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080c14] text-slate-100 antialiased min-h-screen selection:bg-sky-500/30 selection:text-sky-200">
        {children}
      </body>
    </html>
  );
}
