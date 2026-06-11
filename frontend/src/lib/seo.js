const normalizedSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://stocksense.aaronkurian.dev").replace(/\/$/, "")

export const siteConfig = {
  name: "StockSense",
  applicationName: "StockSense",
  description:
    "Explainable AI investment intelligence with portfolio-aware signals, transparent reasoning and human-controlled decisions.",
  url: normalizedSiteUrl,
  ogImagePath: "/og-image.png",
  twitterImagePath: "/og-image.png",
  locale: "en_US",
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path
  return new URL(path, `${siteConfig.url}/`).toString()
}

export function buildPageMetadata({
  title,
  absoluteTitle,
  description,
  path,
  type = "website",
}) {
  const resolvedTitle = absoluteTitle || title

  return {
    title: absoluteTitle ? { absolute: absoluteTitle } : title,
    description,
    alternates: {
      canonical: path,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: resolvedTitle,
      description,
      type,
      url: absoluteUrl(path),
      siteName: siteConfig.name,
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
      title: resolvedTitle,
      description,
      images: [absoluteUrl(siteConfig.twitterImagePath)],
    },
  }
}
