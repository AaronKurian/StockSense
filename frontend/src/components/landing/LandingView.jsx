"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import {
  ArrowRight,
  BarChart3,
  Bell,
  Brain,
  ChevronDown,
  Eye,
  LineChart,
  Lock,
  Menu,
  Shield,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ConfidenceMeter } from "@/components/signals/ConfidenceMeter"

const PRIMARY_CTA = {
  label: "Create Your Watchlist",
  href: "/signup",
}

const navItems = [
  { label: "Product", href: "#product-showcase" },
  { label: "Signals", href: "#explainable-signals" },
  { label: "Portfolio", href: "#portfolio-intelligence" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Methodology", href: "#methodology" },
  { label: "FAQ", href: "#faq" },
]

const trustHighlights = [
  {
    title: "Human-controlled decisions",
    body: "StockSense does not place trades on your behalf. You stay in control of every portfolio action.",
    icon: Shield,
  },
  {
    title: "Explainable recommendations",
    body: "Every signal includes confidence context, supporting evidence and explicit risk factors.",
    icon: Eye,
  },
  {
    title: "Portfolio-aware intelligence",
    body: "Signals are evaluated in the context of your portfolio composition and exposure, not in isolation.",
    icon: LineChart,
  },
]

const sampleSignals = [
  {
    ticker: "AAPL",
    type: "BUY",
    confidence: 79,
    urgency: "Medium",
    reason: "Momentum remains constructive with supportive volume confirmation.",
  },
  {
    ticker: "MSFT",
    type: "HOLD",
    confidence: 68,
    urgency: "Low",
    reason: "Trend strength is stable, while near-term risk/reward is balanced.",
  },
  {
    ticker: "NVDA",
    type: "WATCH",
    confidence: 61,
    urgency: "Medium",
    reason: "Setup is improving but needs additional confirmation before action.",
    risk: "Overextended valuation can increase downside sensitivity.",
  },
]

const productShowcase = [
  {
    title: "Signal-first workspace",
    body: "Structured signal cards surface action, confidence, rationale and risk in one clear view.",
    icon: Zap,
  },
  {
    title: "Continuous monitoring",
    body: "Watchlist and portfolio conditions are evaluated continuously so you can act at the right time.",
    icon: Bell,
  },
  {
    title: "Decision transparency",
    body: "Every recommendation includes supporting factors and confidence context for informed decisions.",
    icon: Brain,
  },
]

const explainability = [
  {
    title: "What the model sees",
    body: "Signals are formed from multiple inputs including market structure, momentum behavior and portfolio context.",
  },
  {
    title: "Why confidence changes",
    body: "Confidence reflects alignment across evidence sources. It can rise or fall as new data arrives.",
  },
  {
    title: "What could invalidate it",
    body: "Each recommendation includes explicit downside scenarios so risks are visible before action.",
  },
]

const portfolioIntelligence = [
  "Understand concentration across sectors and positions before adding risk.",
  "Review active signals against current exposure instead of ticker-by-ticker decisions.",
  "Track recommendation outcomes to improve consistency in your own process.",
]

const workflowSteps = [
  {
    step: "01",
    title: "Monitor",
    body: "StockSense continuously evaluates your watchlist and portfolio for emerging conditions.",
  },
  {
    step: "02",
    title: "Generate",
    body: "When evidence aligns, StockSense produces a structured recommendation with confidence context.",
  },
  {
    step: "03",
    title: "Review",
    body: "You inspect rationale, supporting factors and risk disclosures before taking any action.",
  },
  {
    step: "04",
    title: "Refine",
    body: "Your confirms, ignores and outcomes help personalize future recommendations over time.",
  },
]

const learningLoop = [
  {
    title: "Your intent",
    body: "Watchlist focus and portfolio behavior shape the recommendation context.",
  },
  {
    title: "Signal output",
    body: "StockSense publishes an explainable recommendation with risk framing.",
  },
  {
    title: "Your response",
    body: "Your decisions feed back into the system to improve relevance and timing.",
  },
]

const controls = [
  "Signals are informational and do not constitute financial advice.",
  "Confidence scores indicate model conviction, not guaranteed outcomes.",
  "Recommendations can be wrong and should be reviewed against your own strategy.",
  "You remain fully responsible for all portfolio decisions and trade execution.",
]

const faqs = [
  {
    q: "Is StockSense financial advice?",
    a: "No. StockSense provides AI-generated investment insights, portfolio analysis and market signals for informational purposes only. Nothing on the platform should be considered financial, investment, legal or tax advice. All investment decisions remain your responsibility.",
  },
  {
    q: "How are confidence scores calculated?",
    a: "Confidence scores measure how strongly multiple signals agree with each other. The system evaluates factors such as trend strength, technical indicators, sector performance, portfolio context, market conditions and available sentiment signals. Higher confidence means stronger supporting evidence, not a guaranteed outcome.",
  },
  {
    q: "Does StockSense execute trades automatically?",
    a: "No. StockSense does not place trades on your behalf. Recommendations are presented with supporting evidence and risk considerations and you decide whether to act, ignore or monitor.",
  },
  {
    q: "Why did I receive a recommendation?",
    a: "Every recommendation includes a detailed explanation that shows supporting factors, risk factors, confidence level, portfolio impact and market context. StockSense is designed to explain its reasoning instead of giving black-box outputs.",
  },
  {
    q: "Can recommendations be wrong?",
    a: "Yes. Financial markets are inherently uncertain. Even high-confidence recommendations can perform poorly due to unexpected events, earnings surprises, macro shifts or rapid sentiment changes. Confidence indicates evidence strength, not certainty.",
  },
  {
    q: "How does StockSense personalize recommendations?",
    a: "StockSense learns from your watchlists, portfolio holdings, signal interactions, accepted recommendations, ignored recommendations and risk preferences. Over time, recommendations become more aligned with your investment style and focus.",
  },
  {
    q: "How is my data protected?",
    a: "User data is handled with industry-standard security practices and controlled access patterns. StockSense uses your information to deliver portfolio intelligence, recommendations and personalization features. We do not sell personal portfolio data.",
  },
  {
    q: "What makes StockSense different from stock screeners?",
    a: "Traditional screeners return broad lists based on fixed filters. StockSense evaluates market data in the context of your portfolio, watchlists, current conditions and risk framing, with the goal of surfacing more relevant decisions rather than more noise.",
  },
  {
    q: "What markets does StockSense support?",
    a: "StockSense currently focuses on U.S. equities and ETFs. Support for additional markets and asset classes may expand over time.",
  },
  {
    q: "What information does a recommendation include?",
    a: "Each recommendation includes signal direction, confidence score, supporting evidence, risk factors, portfolio impact context and market context so you can evaluate both opportunity and downside before acting.",
  },
]

function SectionHeading({ eyebrow, title, description, id }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">{eyebrow}</p>
      <h2 id={id} className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h2>
      <p className="text-pretty text-muted-foreground md:text-lg">{description}</p>
    </div>
  )
}

function TypeBadge({ type }) {
  const styleMap = {
    BUY: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    HOLD: "border-blue-500/30 bg-blue-500/10 text-blue-100",
    WATCH: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  }

  return (
    <Badge variant="outline" className={styleMap[type] ?? "border-white/15 bg-white/5 text-foreground"}>
      {type}
    </Badge>
  )
}

function FAQItem({ item, isOpen, onToggle, index }) {
  const id = `faq-item-${index}`

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        className="flex w-full cursor-pointer items-start justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className="text-sm font-medium md:text-base">{item.q}</span>
        <ChevronDown className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div id={id} className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
          {item.a}
        </div>
      )}
    </div>
  )
}

export function LandingView() {
  const [openFaq, setOpenFaq] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const heroSignal = sampleSignals[0]

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 size-[360px] rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -right-20 top-40 size-[320px] rounded-full bg-blue-500/15 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.png" alt="StockSense" width={32} height={32} className="w-10 h-10" priority />
            <span className="text-sm font-semibold tracking-tight">StockSense</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex" aria-label="Primary">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-to-r from-emerald-500 to-blue-500 text-primary-foreground">
              <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
            </Button>
          </div>

          <div className="md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[86vw] border-white/10 bg-background/95 p-0 sm:max-w-sm">
                <SheetHeader className="p-5 pb-2">
                  <SheetTitle>Navigation</SheetTitle>
                  <SheetDescription>Explore StockSense product information</SheetDescription>
                </SheetHeader>
                <div className="space-y-2 px-5 pb-6">
                  {navItems.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className="block rounded-md border border-transparent px-2 py-2 text-sm text-muted-foreground transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-foreground"
                    >
                      {item.label}
                    </a>
                  ))}
                  <Separator className="my-3 bg-white/10" />
                  <Button asChild className="w-full bg-gradient-to-r from-emerald-500 to-blue-500 text-primary-foreground">
                    <Link href={PRIMARY_CTA.href} onClick={() => setMobileNavOpen(false)}>
                      {PRIMARY_CTA.label}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full border-white/15 bg-white/[0.02]">
                    <Link href="/login" onClick={() => setMobileNavOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main-content" className="relative z-10">
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 pb-20 pt-16 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-24">
          <div>
            <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
              AI investment intelligence
            </Badge>
            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.05]">
              Explainable signals for disciplined portfolio decisions.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground md:text-xl">
              StockSense continuously monitors your watchlist and portfolio, then surfaces risk-aware recommendations
              with transparent reasoning so you can act with clarity.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 px-6 text-primary-foreground">
                <Link href={PRIMARY_CTA.href}>
                  {PRIMARY_CTA.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl border-white/15 bg-white/[0.02]">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Informational signals only. Not financial advice. You remain in control of every decision.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full border-white/15 bg-white/[0.03] text-xs text-muted-foreground">
                Signal-first workflow
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/15 bg-white/[0.03] text-xs text-muted-foreground">
                Explainable recommendations
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/15 bg-white/[0.03] text-xs text-muted-foreground">
                Human-in-the-loop control
              </Badge>
            </div>
          </div>

          <Card className="relative overflow-hidden rounded-3xl border-white/10 bg-white/[0.03]">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/10 to-transparent" />
            <CardContent className="relative space-y-5 p-6 md:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Signal snapshot</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {heroSignal.ticker} <span className="text-base text-muted-foreground">· {heroSignal.type}</span>
                  </p>
                </div>
                <TypeBadge type={heroSignal.type} />
              </div>

              <ConfidenceMeter value={heroSignal.confidence} />

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reasoning summary</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{heroSignal.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button className="w-full rounded-md bg-emerald-500 text-emerald-950 hover:bg-emerald-400">Confirm</Button>
                <Button variant="outline" className="w-full rounded-md border-white/15 bg-white/[0.02]">
                  Ignore
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02]" aria-label="Trust and positioning">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-12 md:grid-cols-3 md:px-6">
            {trustHighlights.map(({ title, body, icon: Icon }) => (
              <Card key={title} className="rounded-2xl border-white/10 bg-white/[0.03]">
                <CardContent className="space-y-3 p-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                    <Icon className="size-5 text-emerald-200" />
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="product-showcase" className="mx-auto w-full max-w-6xl space-y-10 px-4 py-20 md:px-6">
          <SectionHeading
            id="product-showcase-heading"
            eyebrow="Product showcase"
            title="A workspace designed for signal-driven investing"
            description="StockSense centers your daily workflow around clear recommendations, portfolio context and fast review cycles."
          />

          <div className="grid gap-4 md:grid-cols-3">
            {productShowcase.map(({ title, body, icon: Icon }) => (
              <Card key={title} className="rounded-2xl border-white/10 bg-white/[0.03]">
                <CardContent className="space-y-3 p-6">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-400/20">
                    <Icon className="size-5 text-blue-200" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden rounded-3xl border-white/10 bg-white/[0.02]">
            <CardContent className="p-0">
              <div className="border-b border-white/10 px-6 py-4">
                <p className="text-sm font-medium">Illustrative signal feed</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Example interface preview for product context. Signals are informational and require user review.
                </p>
              </div>
              <div className="grid gap-0 md:grid-cols-3">
                {sampleSignals.map((signal, idx) => (
                  <div key={signal.ticker} className={`space-y-4 p-5 ${idx > 0 ? "border-t border-white/10 md:border-l md:border-t-0" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold">{signal.ticker}</p>
                      <TypeBadge type={signal.type} />
                    </div>
                    <ConfidenceMeter value={signal.confidence} />
                    <p className="text-sm text-muted-foreground">{signal.reason}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="explainable-signals" className="border-y border-white/10 bg-white/[0.02] py-20">
          <div className="mx-auto w-full max-w-6xl space-y-10 px-4 md:px-6">
            <SectionHeading
              id="explainable-signals-heading"
              eyebrow="Explainable signals"
              title="Recommendations that show their work"
              description="StockSense is built for transparency: evidence in, recommendation out and risk surfaced before action."
            />

            <div className="grid gap-4 md:grid-cols-3">
              {explainability.map((item) => (
                <Card key={item.title} className="rounded-2xl border-white/10 bg-white/[0.03]">
                  <CardContent className="space-y-3 p-6">
                    <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="portfolio-intelligence" className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-20 md:px-6 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div className="space-y-5">
            <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">Portfolio intelligence</p>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              See recommendations in the context of your full portfolio
            </h2>
            <p className="text-muted-foreground md:text-lg">
              StockSense helps you understand not only what to do next, but how each decision may affect concentration,
              risk and portfolio balance.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {portfolioIntelligence.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="bg-gradient-to-r from-emerald-500 to-blue-500 text-primary-foreground">
              <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
            </Button>
          </div>

          <Card className="rounded-3xl border-white/10 bg-white/[0.03]">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold">Portfolio context panel</p>
                <BarChart3 className="size-5 text-muted-foreground" />
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Largest concentration</span>
                  <span className="font-medium">Technology</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Signal conflict alerts</span>
                  <span className="font-medium">2 active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Recent action cadence</span>
                  <span className="font-medium">Moderate</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Context panels are provided to support decision quality. They do not replace your own judgment,
                suitability analysis or risk process.
              </p>
            </CardContent>
          </Card>
        </section>

        <section id="how-it-works" className="border-y border-white/10 bg-white/[0.02] py-20">
          <div className="mx-auto w-full max-w-6xl space-y-10 px-4 md:px-6">
            <SectionHeading
              id="how-it-works-heading"
              eyebrow="How it works"
              title="From market movement to informed decision"
              description="StockSense is designed to reduce noise, improve clarity and preserve investor control at every step."
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map((step) => (
                <Card key={step.step} className="rounded-2xl border-white/10 bg-white/[0.03]">
                  <CardContent className="space-y-3 p-6">
                    <p className="text-xs font-semibold tracking-[0.14em] text-emerald-300 uppercase">Step {step.step}</p>
                    <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl space-y-10 px-4 py-20 md:px-6" aria-labelledby="learning-loop-heading">
          <SectionHeading
            id="learning-loop-heading"
            eyebrow="Personalization"
            title="A learning loop tuned by your decisions"
            description="StockSense adapts over time based on your interactions and portfolio behavior, without removing your control."
          />

          <div className="grid gap-4 md:grid-cols-3">
            {learningLoop.map((item, index) => (
              <Card key={item.title} className="rounded-2xl border-white/10 bg-white/[0.03]">
                <CardContent className="space-y-3 p-6">
                  <p className="text-xs text-muted-foreground">Loop {index + 1}</p>
                  <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="methodology" className="border-y border-white/10 bg-white/[0.02] py-20" aria-labelledby="methodology-heading">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:px-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">Security & risk controls</p>
              <h2 id="methodology-heading" className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Methodology grounded in transparency and risk awareness
              </h2>
              <p className="text-muted-foreground md:text-lg">
                StockSense is designed for informed investing, not blind automation. Signals are generated to support
                analysis and should be evaluated within your own risk framework.
              </p>

              <div className="space-y-3">
                {controls.map((item) => (
                  <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
                    <Lock className="mt-0.5 size-4 shrink-0 text-emerald-200" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <Card className="rounded-3xl border-white/10 bg-white/[0.03]">
              <CardContent className="space-y-3 px-6 py-4">
                <h3 className="text-lg font-semibold tracking-tight">Decision framework summary</h3>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground">Signal intent</p>
                    <p className="mt-1">Prioritize clarity and context over volume of alerts.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Risk communication</p>
                    <p className="mt-1">Surface downside scenarios and uncertainty with every recommendation.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">User authority</p>
                    <p className="mt-1">Keep investors in control from recommendation review through final execution.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Signal alignment</p>
                    <p className="mt-1">Ensure signals are aligned with your portfolio and watchlist.</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Signal quality</p>
                    <p className="mt-1">Ensure signals are of high quality and are not spam or noise.</p>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full border-white/15 bg-white/[0.02]">
                  <Link href="/risk-disclosure">Read risk disclosure</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="faq" className="mx-auto w-full max-w-4xl space-y-10 px-4 py-20 md:px-6" aria-labelledby="faq-heading">
          <SectionHeading
            id="faq-heading"
            eyebrow="FAQ"
            title="Common questions"
            description="Answers to key questions about signals, confidence, control and risk handling in StockSense."
          />

          <div className="space-y-3">
            {faqs.map((item, index) => (
              <FAQItem
                key={item.q}
                item={item}
                index={index}
                isOpen={openFaq === index}
                onToggle={() => setOpenFaq(openFaq === index ? -1 : index)}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-6" aria-labelledby="final-cta-heading">
          <Card className="overflow-hidden rounded-3xl border-white/10 bg-white/[0.03] pt-0">
            <CardContent className="relative space-y-6 p-8 text-center md:p-12">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-500/12 to-transparent" />
              <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300 uppercase">Start with clarity</p>
              <h2 id="final-cta-heading" className="mx-auto max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">
                Build your signal-driven workflow with confidence and control
              </h2>
              <p className="mx-auto max-w-xl text-muted-foreground md:text-lg">
                Use StockSense to monitor what matters, evaluate recommendations transparently and make portfolio
                decisions on your terms.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 px-7 text-primary-foreground">
                  <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-xl border-white/15 bg-white/[0.02]">
                  <Link href="/dashboard">View Dashboard</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Signals are informational and can be wrong. Always apply your own judgment before trading.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/30 py-12">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Image src="/favicon.png" alt="StockSense" width={28} height={28} className="rounded-md" />
              <span className="text-sm font-semibold tracking-tight">StockSense</span>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              AI investment intelligence focused on explainable signals, portfolio context and human decision control.
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">Product</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link className="block transition-colors hover:text-foreground" href="/dashboard">
                Dashboard
              </Link>
              <Link className="block transition-colors hover:text-foreground" href="/signals">
                Signals
              </Link>
              <Link className="block transition-colors hover:text-foreground" href="/watchlist">
                Watchlist
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">Resources</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link className="block transition-colors hover:text-foreground" href="/#faq">
                FAQ
              </Link>
              <Link className="block transition-colors hover:text-foreground" href="/#methodology">
                Methodology
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">Legal</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link className="block transition-colors hover:text-foreground" href="/privacy-policy">
                Privacy Policy
              </Link>
              <Link className="block transition-colors hover:text-foreground" href="/terms-of-service">
                Terms of Service
              </Link>
              <Link className="block transition-colors hover:text-foreground" href="/risk-disclosure">
                Risk Disclosure
              </Link>
              {/* <Link className="block transition-colors hover:text-foreground" href="/cookie-policy">
                Cookie Policy
              </Link> */}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 w-full max-w-6xl border-t border-white/10 px-4 pt-6 md:px-6">
          <p className="mt-3 text-xs text-muted-foreground">© {new Date().getFullYear()} StockSense. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
