import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Terms of Service",
  description:
    "Read the terms governing use of StockSense services, including responsibilities, limitations and legal conditions.",
  path: "/terms-of-service",
  type: "article",
})

const sections = [
  {
    heading: "Agreement to terms",
    paragraphs: [
      "By accessing or using StockSense, you agree to these Terms of Service. If you do not agree, do not use the platform.",
      "You are responsible for ensuring your use of StockSense is lawful in your jurisdiction.",
    ],
  },
  {
    heading: "Service scope",
    paragraphs: [
      "StockSense provides informational investment intelligence, including signal generation, watchlist monitoring and portfolio context tools.",
      "StockSense does not provide financial, legal or tax advice and does not guarantee outcomes from any recommendation or insight.",
    ],
  },
  {
    heading: "User responsibilities",
    paragraphs: [
      "You are solely responsible for investment decisions, trade execution and evaluation of any recommendation before acting.",
      "You agree not to misuse the service, interfere with platform operations, attempt unauthorized access or violate applicable law.",
    ],
  },
  {
    heading: "Disclaimers and limitation of liability",
    paragraphs: [
      "The platform is provided on an “as is” and “as available” basis without warranties of any kind, whether express or implied.",
      "To the maximum extent permitted by law, StockSense is not liable for indirect, incidental, special, consequential or punitive damages arising from use of the service.",
    ],
  },
  {
    heading: "Changes and termination",
    paragraphs: [
      "We may modify these terms from time to time. Updated terms become effective when posted and continued use indicates acceptance.",
      "We may suspend or terminate access in cases of misuse, security risk, legal requirement or violation of these terms.",
    ],
  },
]

export default function TermsOfServicePage() {
  return (
    <LegalPageTemplate
      title="Terms of Service"
      description="These Terms govern your access to and use of StockSense services, products and related features."
      lastUpdated="June 11, 2026"
      sections={sections}
    />
  )
}
