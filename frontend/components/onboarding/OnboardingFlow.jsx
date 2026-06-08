"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const demoOnboardingSteps = [
  { key: "risk", question: "What is your risk appetite?", chips: ["Conservative", "Moderate", "Aggressive"] },
  { key: "horizon", question: "What is your investment horizon?", chips: ["Short (< 1 year)", "Medium (1-5 years)", "Long (5+ years)"] },
  { key: "sectors", question: "Which sectors interest you?", chips: ["Technology", "Healthcare", "Finance", "Energy", "Consumer"] },
  { key: "watchlist", question: "Add tickers to your watchlist", chips: ["AAPL, MSFT", "NVDA, AMD", "TSLA, GOOGL"] },
  { key: "notify", question: "How should we notify you?", chips: ["Push + Email", "Push only", "In-app only"] },
]
const demoOnboardingSummary = { risk: "Moderate", capital: "$100,000", horizon: "1-5 years", sectors: ["Technology", "Healthcare"], watchlist: ["AAPL", "MSFT", "NVDA"], lossTolerance: "10%", notifications: "Push + Email" }

function useTypedQuestion(text, active) {
  const [shown, setShown] = useState("")
  useEffect(() => {
    if (!active) return
    setShown("")
    let i = 0
    const id = setInterval(() => {
      i += 1
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, 18)
    return () => clearInterval(id)
  }, [text, active])
  return shown
}

export function OnboardingFlow() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [done, setDone] = useState(false)

  const current = demoOnboardingSteps[step]
  const typed = useTypedQuestion(current?.question ?? "", !done && step < demoOnboardingSteps.length)

  const progress = useMemo(() => {
    if (done) return 100
    return Math.round(((step + (typed.length >= (current?.question?.length ?? 1) ? 1 : 0.35)) / demoOnboardingSteps.length) * 100)
  }, [step, typed, current, done])

  const pick = (value) => {
    setAnswers((a) => ({ ...a, [current.key]: value }))
    if (step < demoOnboardingSteps.length - 1) {
      setStep((s) => s + 1)
    } else {
      setDone(true)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-b from-emerald-500/20 via-blue-500/10 to-transparent blur-3xl" />
      </div>
      <div className="relative mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-12">
        <Card className="h-fit rounded-2xl border-white/10 bg-white/[0.04] backdrop-blur-xl lg:sticky lg:top-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-emerald-300" />
              Guided setup
            </CardTitle>
            <p className="text-xs text-muted-foreground">ChatGPT-like onboarding - structured for MongoDB writes later.</p>
            <Progress value={progress} className="mt-3 h-2 bg-white/10" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-3 lg:h-[420px]">
              <div className="space-y-2">
                {demoOnboardingSteps.map((s, i) => {
                  const complete = i < step || (done && i <= step)
                  const active = i === step && !done
                  return (
                    <div
                      key={s.key}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-xs transition-colors",
                        active && "border-emerald-500/40 bg-emerald-500/10",
                        complete && !active && "border-white/10 bg-white/5 text-muted-foreground",
                        !complete && !active && "border-white/5 bg-black/20 text-muted-foreground/70",
                      )}
                    >
                      <p className="font-semibold text-foreground">{s.question.slice(0, 42)}…</p>
                      {answers[s.key] ? (
                        <p className="mt-1 text-[11px] text-emerald-200/90">Saved: {answers[s.key]}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {!done ? (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-mono">
                    Step {step + 1}/{demoOnboardingSteps.length}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-emerald-400" />
                  <span>Agent asks, you tap - no blank canvas.</span>
                </div>
                <Card className="rounded-[1.75rem] border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
                  <CardContent className="space-y-5 p-6 md:p-8">
                    <div className="flex gap-3">
                      <div className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30 ring-1 ring-white/10">
                        <Sparkles className="size-4 text-emerald-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground">StockSense agent</p>
                        <p className="mt-2 text-lg leading-relaxed md:text-xl">{typed}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {current.chips.map((c) => (
                        <Button
                          key={c}
                          variant="outline"
                          className="rounded-full border-white/15 bg-black/30 px-4 text-sm hover:border-emerald-500/40 hover:bg-emerald-500/10"
                          onClick={() => pick(c)}
                        >
                          {c}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <Card className="overflow-hidden rounded-[1.75rem] border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-transparent to-blue-500/15 shadow-2xl">
                  <CardContent className="space-y-6 p-8">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
                        <Check className="size-6 text-emerald-200" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-100">Onboarding complete</p>
                        <h2 className="text-2xl font-semibold tracking-tight">Your agent is calibrated.</h2>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries({
                        risk: answers.risk ?? demoOnboardingSummary.risk,
                        capital: answers.capital ?? demoOnboardingSummary.capital,
                        horizon: answers.horizon ?? demoOnboardingSummary.horizon,
                        sectors: answers.sectors ?? demoOnboardingSummary.sectors.join(", "),
                        watchlist: answers.watchlist ?? demoOnboardingSummary.watchlist.join(", "),
                        lossTolerance: answers.loss ?? demoOnboardingSummary.lossTolerance,
                        notifications: answers.notify ?? demoOnboardingSummary.notifications,
                      }).map(([k, v]) => (
                        <div key={k} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p>
                          <p className="mt-1 font-medium">{Array.isArray(v) ? v.join(", ") : String(v)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        asChild
                        size="lg"
                        className="rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-8 text-emerald-950"
                      >
                        <Link href="/dashboard">Enter command center</Link>
                      </Button>
                      <Button asChild size="lg" variant="outline" className="rounded-2xl border-white/15">
                        <Link href="/signals">Preview signals</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <motion.div
                  aria-hidden
                  className="pointer-events-none flex justify-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {Array.from({ length: 18 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="size-1.5 rounded-full bg-emerald-400/80"
                      initial={{ y: 0, opacity: 0.2 }}
                      animate={{ y: [0, -10, 0], opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.05 }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">Live summary card</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Risk appetite</p>
                <p className="font-medium">{answers.risk ?? demoOnboardingSummary.risk}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Capital band</p>
                <p className="font-medium">{answers.capital ?? demoOnboardingSummary.capital}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Horizon</p>
                <p className="font-medium">{answers.horizon ?? demoOnboardingSummary.horizon}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notifications</p>
                <p className="font-medium">{answers.notify ?? demoOnboardingSummary.notifications}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
