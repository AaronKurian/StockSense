import { HomePageClient } from "@/components/landing/HomePageClient"
import { buildPageMetadata, absoluteUrl, siteConfig } from "@/lib/seo"

export const metadata = buildPageMetadata({
  absoluteTitle: "StockSense | AI Investment Intelligence",
  description:
    "Portfolio-aware AI signals with explainable reasoning, risk context and human-controlled decisions.",
  path: "/",
  type: "website",
})

const homeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: absoluteUrl("/favicon.png"),
    },
    {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
      publisher: {
        "@type": "Organization",
        name: siteConfig.name,
      },
    },
  ],
}

export default function HomePage() {
  return <HomePageClient structuredData={homeStructuredData} />
}
