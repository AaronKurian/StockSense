import { Inter, JetBrains_Mono } from "next/font/google"
import { Providers } from "@/providers/providers"
import { siteConfig, absoluteUrl } from "@/lib/seo"
import "./globals.css"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "StockSense | AI Investment Intelligence",
    template: "%s | StockSense",
  },
  description: siteConfig.description,
  keywords: [
    "AI investment intelligence",
    "portfolio signals",
    "explainable investing",
    "risk-aware recommendations",
    "portfolio analytics",
  ],
  authors: [{ name: "StockSense" }],
  creator: "StockSense",
  publisher: "StockSense",
  applicationName: siteConfig.applicationName,
  category: "finance",
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
  },
  openGraph: {
    title: "StockSense | AI Investment Intelligence",
    description: siteConfig.description,
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: "website",
    images: [
      {
        url: absoluteUrl(siteConfig.ogImagePath),
        width: 1200,
        height: 630,
        alt: "StockSense - AI investment intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StockSense | AI Investment Intelligence",
    description: siteConfig.description,
    images: [absoluteUrl(siteConfig.twitterImagePath)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.name,
  },
}

export const viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} min-h-dvh font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
