import { LegalPageTemplate } from "@/components/legal/LegalPageTemplate"
import { buildPageMetadata } from "@/lib/seo"

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "Learn how StockSense collects, uses, protects and manages personal and portfolio-related information.",
  path: "/privacy-policy",
  type: "article",
})

const sections = [
  {
    heading: "Information we collect",
    paragraphs: [
    "We collect information you provide directly when creating and using a StockSense account, including your name, email address, authentication credentials, profile preferences and account settings.",
    "To provide portfolio-aware investment intelligence, we may store watchlists, portfolio positions, virtual portfolio activity, recommendation feedback, risk preferences and other investment-related inputs you choose to provide.",
    "We also collect technical and usage information such as device information, browser type, IP address, session activity, feature usage and interaction data required to operate, secure and improve the platform.",
    "If you enable notifications, we may store browser or device push notification subscription information in order to deliver alerts, recommendation updates and platform notifications."
    ],
  },
  {
    heading: "How we use information",
    paragraphs: [
    "We use collected information to operate and maintain StockSense, generate portfolio-aware recommendations, personalize the user experience, deliver notifications, provide customer support and improve platform functionality.",
    "Information may also be used to monitor system performance, detect abuse, prevent fraud, maintain security and improve model quality and recommendation relevance.",
    "We may use aggregated or de-identified analytics for research, product improvement, reporting and operational planning."
    ],
  },
  {
    heading: "Information sharing",
    paragraphs: [
    "We do not sell your personal information. We may share information with trusted service providers that support hosting, infrastructure, authentication, analytics, notifications, security and other core platform operations.",
    "Information may be disclosed when required by law, regulation, court order, legal process or governmental request or when necessary to protect the rights, safety and security of StockSense, its users or the public."
    ],
  },
  {
    heading: "Data retention and security",
    paragraphs: [
    "We retain information only for as long as necessary to provide services, comply with legal obligations, resolve disputes, enforce agreements and support legitimate business operations.",
    "StockSense implements reasonable administrative, technical and organizational safeguards designed to protect information from unauthorized access, misuse, disclosure, alteration or destruction. However, no method of electronic storage or transmission is completely secure."
    ],
  },
  {
    heading: "Your choices and rights",
    paragraphs: [
    "You may update account information, modify preferences, manage notification settings and request account deletion by contacting support.",
    "Depending on applicable laws in your jurisdiction, you may have rights related to access, correction, deletion, portability, restriction or objection to certain forms of data processing."
    ],
  },
  {
    heading: "Investment data and recommendations",
    paragraphs: [
    "Portfolio information, watchlists, recommendation history and feedback are used solely to provide and improve StockSense features and personalization.",
    "StockSense provides informational insights and model-generated recommendations. Portfolio and recommendation data are not shared publicly and are not sold to third parties."
    ],
  },
  ]
  

export default function PrivacyPolicyPage() {
  return (
    <LegalPageTemplate
      title="Privacy Policy"
      description="This Privacy Policy explains how StockSense collects, uses, stores and protects personal information when you use our services."
      lastUpdated="June 11, 2026"
      sections={sections}
    />
  )
}
