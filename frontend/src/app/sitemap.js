import { siteConfig, absoluteUrl } from "@/lib/seo"

const coreRoutes = [
  "/",
  "/privacy-policy",
  "/terms-of-service",
  "/risk-disclosure",
  "/cookie-policy",
]

export default function sitemap() {
  const now = new Date()

  return coreRoutes.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5,
  }))
}
