import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

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
    <html lang="en" className={plusJakarta.variable}>
      <body className={`${plusJakarta.className} bg-[#F4F6FA] text-slate-900 antialiased min-h-screen selection:bg-blue-600/15 selection:text-blue-900`}>
        {children}
      </body>
    </html>
  );
}
