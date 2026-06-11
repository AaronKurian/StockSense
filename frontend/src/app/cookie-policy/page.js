import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Cookie Policy",
  description:
    "Review how StockSense uses cookies and similar technologies for security, sessions and product improvements.",
  path: "/cookie-policy",
  type: "article",
})

const sections = [
  {
    heading: "What cookies are",
    paragraphs: [
      "Cookies are small text files stored on your device that help websites and applications recognize sessions and remember preferences.",
      "StockSense uses cookies and similar technologies to support reliable service delivery and improve user experience.",
    ],
  },
  {
    heading: "How we use cookies",
    paragraphs: [
      "We use essential cookies for authentication, session continuity, security controls and core platform functionality.",
      "We may also use analytics technologies to understand product usage patterns and improve performance.",
    ],
  },
  {
    heading: "Third-party technologies",
    paragraphs: [
      "Some cookies or tracking technologies may be set by service providers that help us operate infrastructure, analytics or customer support workflows.",
      "These providers are permitted to use data only for authorized business purposes under applicable agreements.",
    ],
  },
  {
    heading: "Your controls",
    paragraphs: [
      "You can manage cookie settings through your browser controls, including blocking or deleting existing cookies.",
      "Disabling certain cookies may affect product functionality, including sign-in persistence and personalization behavior.",
    ],
  },
  {
    heading: "Policy updates",
    paragraphs: [
      "We may update this Cookie Policy as technologies or legal requirements evolve.",
      "Continued use of StockSense after updates indicates acceptance of the revised policy.",
    ],
  },
]

export default function CookiePolicyPage() {
  return (
    <LegalPageTemplate
      title="Cookie Policy"
      description="This Cookie Policy explains how StockSense uses cookies and similar technologies across our platform."
      lastUpdated="June 11, 2026"
      sections={sections}
    />
  )
}
