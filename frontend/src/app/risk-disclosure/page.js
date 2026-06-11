import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Risk Disclosure",
  description:
    "Understand key risks, limitations and non-advisory boundaries related to StockSense recommendations.",
  path: "/risk-disclosure",
  type: "article",
})

const sections = [
  {
    heading: "No investment advice",
    paragraphs: [
      "StockSense provides informational analysis and model-generated signals. Nothing on the platform should be interpreted as personalized investment advice.",
      "You should independently evaluate suitability and consult qualified professionals where appropriate.",
    ],
  },
  {
    heading: "Market risk",
    paragraphs: [
      "All investing involves risk, including volatility, liquidity constraints, macroeconomic changes and potential loss of principal.",
      "Past market behavior and historical patterns do not guarantee future performance.",
    ],
  },
  {
    heading: "Model and confidence limitations",
    paragraphs: [
      "Confidence scores indicate model conviction based on available data at a point in time. They are not guarantees of outcome.",
      "Recommendations may be incorrect, delayed, incomplete or affected by changing market conditions and data quality.",
    ],
  },
  {
    heading: "Execution responsibility",
    paragraphs: [
      "StockSense does not execute trades for you. You remain fully responsible for order placement, position sizing and risk controls.",
      "Before acting on any recommendation, review your own objectives, constraints and risk tolerance.",
    ],
  },
  {
    heading: "Portfolio outcomes",
    paragraphs: [
      "Use of StockSense does not ensure portfolio gains, risk reduction or objective achievement.",
      "You accept that losses can occur even when recommendations appear high-confidence or well-explained.",
    ],
  },
]

export default function RiskDisclosurePage() {
  return (
    <LegalPageTemplate
      title="Risk Disclosure"
      description="This Risk Disclosure outlines important limitations and risks related to using StockSense insights and recommendations."
      lastUpdated="June 11, 2026"
      sections={sections}
    />
  )
}
