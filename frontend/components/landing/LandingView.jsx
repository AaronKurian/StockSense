"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Bell,
  Brain,
  LineChart,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  demoArchitectureFlow,
  demoMarketSummary,
  demoSignals,
  demoTestimonials,
} from "@/data/demo-data"
import { ArchitectureFlow } from "@/components/onboarding/ArchitectureFlow"
import { ConfidenceMeter } from "@/components/signals/ConfidenceMeter"
import { formatPct } from "@/lib/format"

const features = [
  {
    title: "Proactive signals",
    body: "BUY / HOLD / EXIT cards with confidence, urgency, risks, and rationale — not a chat-first toy.",
    icon: Zap,
  },
  {
    title: "Explainable AI",
    body: "Every recommendation ships with supporting factors, counterfactual risks, and indicator context.",
    icon: Shield,
  },
  {
    title: "MongoDB memory",
    body: "Watchlists, signals, and outcomes live in Atlas. MCP tools let agents query memory safely.",
    icon: Brain,
  },
  {
    title: "Realtime delivery",
    body: "SSE streams + Web Push hooks in the UI architecture — demo toasts simulate live agent updates.",
    icon: Bell,
  },
  {
    title: "Portfolio intelligence",
    body: "Sector allocation, risk score, and performance analytics tuned for hackathon-grade storytelling.",
    icon: LineChart,
  },
  {
    title: "Learning loop",
    body: "recommendation_log captures confirms/ignores so Gemini can personalize the next signal pass.",
    icon: Sparkles,
  },
]

export function LandingView() {
  const heroSignal = demoSignals[0]

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-20 size-[420px] rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -right-24 top-40 size-[380px] rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[120%] -translate-x-1/2 bg-gradient-to-t from-emerald-500/10 to-transparent blur-2xl" />
      </div>
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-6 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30 ring-1 ring-white/10">
            <Brain className="size-5 text-emerald-200" />
          </div>
          <span className="text-sm font-semibold tracking-tight">StockSense</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#architecture" className="hover:text-foreground">
            Architecture
          </a>
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#signals" className="hover:text-foreground">
            Signals
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-xl">
            <Link href="/login">Log in</Link>
          </Button>
          <Button
            asChild
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 text-emerald-950 shadow-lg shadow-emerald-500/25"
          >
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10 md:px-6 md:pt-16">
        <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Badge variant="outline" className="mb-4 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
                MongoDB + Gemini hackathon build
              </Badge>
              <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.05]">
                Personal AI that{" "}
                <span className="text-gradient">tells you what to do</span> — before you ask.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-lg text-muted-foreground md:text-xl">
                StockSense is a signal-first investment intelligence system: continuous monitoring, structured
                reasoning, and a feedback loop stored in MongoDB.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-7 text-emerald-950 shadow-xl shadow-emerald-500/30"
                >
                  <Link href="/onboarding">
                    Start onboarding
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl border-white/15 bg-white/5">
                  <Link href="/dashboard">Preview dashboard</Link>
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono">
                  Next.js 15 · App Router
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono">
                  SSE-ready client
                </span>
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono">
                  Web Push UI hooks
                </span>
              </div>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="relative"
          >
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-emerald-500/20 via-transparent to-blue-500/20 blur-2xl" />
            <Card className="overflow-hidden rounded-[1.75rem] border-white/10 bg-white/[0.04] shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
              <CardContent className="space-y-4 p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Live AI signal (demo)</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {heroSignal.type}{" "}
                      <span className="bg-gradient-to-r from-emerald-300 to-cyan-200 bg-clip-text text-transparent">
                        {heroSignal.ticker}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                    </span>
                    Agent live
                  </div>
                </div>
                <ConfidenceMeter value={heroSignal.confidence} />
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Reason</p>
                  <p className="mt-2 leading-relaxed">{heroSignal.headline}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button className="rounded-xl bg-emerald-500 text-emerald-950 hover:bg-emerald-400">Confirm</Button>
                  <Button variant="outline" className="rounded-xl border-white/15">
                    Ignore
                  </Button>
                  <Button variant="secondary" className="rounded-xl">
                    Snooze
                  </Button>
                </div>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-blue-500/10 to-emerald-500/10 p-4 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>{demoMarketSummary.indexName}</span>
                    <span className="font-mono text-emerald-200">{formatPct(demoMarketSummary.indexChangePct)}</span>
                  </div>
                  <p className="mt-2">
                    {demoMarketSummary.breadth} · {demoMarketSummary.status === "open" ? "Market open" : "Closed"} ·
                    UI simulates streaming updates
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        <section id="signals" className="mt-24 space-y-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Realtime signal showcase</h2>
            <p className="mt-3 text-muted-foreground">
              The product experience is anchored on high-signal cards — chat is secondary for onboarding and
              explanations.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {demoSignals.slice(0, 3).map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="h-full rounded-2xl border-white/10 bg-white/[0.03]">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="rounded-lg border-white/15">
                        {s.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">{s.urgency} urgency</span>
                    </div>
                    <p className="text-lg font-semibold">
                      {s.ticker}{" "}
                      <span className="text-sm font-normal text-muted-foreground">{s.name}</span>
                    </p>
                    <ConfidenceMeter value={s.confidence} />
                    <p className="text-sm text-muted-foreground">{s.headline}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-24 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Architecture you can defend on stage</h2>
              <p className="mt-3 text-muted-foreground">
                The UI mirrors the real system: PWA client → Express → Agent Builder → Gemini → MongoDB → push-ready
                alerts → feedback loop.
              </p>
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                {demoArchitectureFlow.slice(0, 4).map((s) => (
                  <div key={s.id} className="flex gap-3">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <div>
                      <p className="font-medium text-foreground">{s.label}</p>
                      <p>{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Card className="rounded-2xl border-emerald-500/20 bg-black/40">
              <CardContent className="space-y-4 p-6 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Flywheel</p>
                <p>
                  Push notification → user action → <span className="font-mono text-emerald-200">recommendation_log</span>{" "}
                  → preference update → better next signal.
                </p>
                <p>
                  MongoDB MCP enables agents to query collections with guardrails — ideal for watchlists, outcomes, and
                  long-horizon memory.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="architecture" className="mt-24 space-y-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">End-to-end flow</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              This is the same story your backend slide will tell — now visualized in-product for judges.
            </p>
          </div>
          <ArchitectureFlow />
        </section>

        <section id="features" className="mt-24 space-y-8">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Built for a final demo</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="h-full rounded-2xl border-white/10 bg-white/[0.03] transition-colors hover:border-emerald-500/25">
                  <CardContent className="space-y-3 p-6">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 ring-1 ring-white/10">
                      <f.icon className="size-5 text-emerald-200" />
                    </div>
                    <p className="text-lg font-semibold">{f.title}</p>
                    <p className="text-sm text-muted-foreground">{f.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-2">
          {demoTestimonials.map((t) => (
            <Card key={t.name} className="rounded-2xl border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent">
              <CardContent className="space-y-4 p-6">
                <p className="text-sm leading-relaxed text-muted-foreground">“{t.quote}”</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black/30 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 md:flex-row md:items-center md:px-6">
          <div>
            <p className="text-sm font-semibold">StockSense</p>
            <p className="mt-1 text-xs text-muted-foreground">Demo UI · no live trading · no backend in this build.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/signals" className="hover:text-foreground">
              Signals
            </Link>
            <Link href="/history" className="hover:text-foreground">
              History
            </Link>
            <Link href="/settings" className="hover:text-foreground">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
