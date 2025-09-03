import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ErrorBoundary } from "@/components/error-boundary"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "PrepX - AI Trading Bot",
  description:
    "Advanced AI-powered trading bot for cryptocurrency markets. Automated trading with intelligent risk management and real-time analytics.",
  generator: "PrepX",
  keywords: ["AI trading", "cryptocurrency", "trading bot", "automated trading", "crypto trading"],
  authors: [{ name: "PrepX Team" }],
  creator: "PrepX",
  publisher: "PrepX",
  robots: "index, follow",
  openGraph: {
    title: "PrepX - AI Trading Bot",
    description: "Advanced AI-powered trading bot for cryptocurrency markets",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrepX - AI Trading Bot",
    description: "Advanced AI-powered trading bot for cryptocurrency markets",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
