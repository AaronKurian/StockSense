"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { completeOnboarding } from "@/lib/api"
import { requestInitialAgentScan } from "@/lib/events"
import { SectorChipSelector } from "@/components/common/SectorChipSelector"
import { WatchlistStockSelector } from "@/components/common/WatchlistStockSelector"

const baseSteps = [
  { key: "risk", question: "What is your risk appetite?", chips: ["Conservative", "Moderate", "Aggressive"] },
  { key: "horizon", question: "What is your investment horizon?", chips: ["Short (< 1 year)", "Medium (1-5 years)", "Long (5+ years)"] },
  { key: "sectors", question: "Which sectors interest you? (select any - optional)" },
  { key: "watchlist", question: "Which stocks would you like StockSense to monitor?", chips: [] },
]

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

function WatchlistStep({ sectors, selectedTickers, setSelectedTickers, onConfirm, onSkip, onBack }) {
  const maxStocks = 20
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Selected ({selectedTickers.length}/{maxStocks})
      </p>
      <WatchlistStockSelector
        sectors={sectors}
        stocks={selectedTickers}
        maxStocks={maxStocks}
        listVariant="chips"
        onAdd={async (ticker, name) => {
          setSelectedTickers((prev) => {
            if (prev.find((t) => t.ticker === ticker) || prev.length >= maxStocks) return prev
            return [...prev, { ticker, name }]
          })
        }}
        onRemove={async (ticker) => {
          setSelectedTickers((prev) => prev.filter((t) => t.ticker !== ticker))
        }}
      />
      <div className="flex items-center gap-2 pt-1">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full border border-white/10 px-3 text-xs text-muted-foreground hover:border-white/20 hover:text-foreground"
            onClick={onBack}
          >
            <ChevronLeft className="mr-1 size-3.5" />
            Back
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-white/15 bg-black/30 px-4 text-xs hover:border-white/20 hover:bg-white/5"
          onClick={onSkip}
        >
          Skip for now
        </Button>
        {selectedTickers.length > 0 && (
          <Button
            size="sm"
            className="rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 px-5 text-xs text-emerald-950"
            onClick={onConfirm}
          >
            Continue ({selectedTickers.length})
          </Button>
        )}
      </div>
    </div>
  )
}

function formatSavedAnswer(value) {
  if (value == null || value === "") return null
  if (Array.isArray(value)) return value.join(", ")
  return String(value)
}

export default function OnboardingFlow() {
  useEffect(() => { document.title = "Onboarding - StockSense" }, [])
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [sectorSelection, setSectorSelection] = useState([])
  const [selectedTickers, setSelectedTickers] = useState([])
  const [done, setDone] = useState(false)
  const [redirectCount, setRedirectCount] = useState(5)

  useEffect(() => {
    if (!done) return
    if (redirectCount === 0) {
      router.push("/dashboard")
      return
    }
    const t = setTimeout(() => setRedirectCount((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [done, redirectCount, router])

  const goToDashboard = () => router.push("/dashboard")

  const steps = useMemo(() => baseSteps, [])
  const current = steps[step]
  const typed = useTypedQuestion(current?.question ?? "", !done && step < steps.length)

  const progress = useMemo(() => {
    if (done) return 100
    return Math.round(((step + (typed.length >= (current?.question?.length ?? 1) ? 1 : 0.35)) / steps.length) * 100)
  }, [step, typed, current, done, steps.length])

  const pick = (value) => {
    const updatedAnswers = { ...answers, [current.key]: value }
    setAnswers(updatedAnswers)
    if (step < steps.length - 1) {
      setStep((s) => s + 1)
    } else {
      setDone(true)
      requestInitialAgentScan()

      const sectorPrefs = Array.isArray(updatedAnswers.sectors) ? updatedAnswers.sectors : []
      completeOnboarding({
        risk: updatedAnswers.risk || null,
        horizon: updatedAnswers.horizon || null,
        preferred_sectors: sectorPrefs,
        watchlist: updatedAnswers.watchlist || null,
      }).catch((err) => console.error("[Onboarding] Save failed:", err))
    }
  }

  const confirmWatchlist = () => {
    const value = selectedTickers.map((t) => t.ticker).join(", ")
    pick(value)
  }

  const skipWatchlist = () => {
    pick("Skipped")
  }

  const isWatchlistStep = current?.key === "watchlist"
  const isSectorsStep = current?.key === "sectors"

  const confirmSectors = () => {
    const updatedAnswers = { ...answers, sectors: sectorSelection }
    setAnswers(updatedAnswers)
    setStep((s) => s + 1)
  }

  const skipSectors = () => {
    const updatedAnswers = { ...answers, sectors: [] }
    setAnswers(updatedAnswers)
    setSectorSelection([])
    setStep((s) => s + 1)
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-b from-emerald-500/20 via-blue-500/10 to-transparent blur-3xl" />
      </div>
      <div className="relative m-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-12">
        {}
        <Card className="h-fit rounded-2xl border-white/10 bg-white/[0.04] backdrop-blur-xl lg:sticky lg:top-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-emerald-300" />
              Welcome to StockSense
            </CardTitle>
            <p className="text-xs text-muted-foreground">Answer a few questions to get started.</p>
            <Progress value={progress} className="mt-3 h-2 bg-white/10" />
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-full pr-3">
              <div className="space-y-2">
                {steps.map((s, i) => {
                  const complete = i < step || (done && i <= step)
                  const active = i === step && !done
                  return (
                    <div
                      key={s.key}
                      className={cn(
                        "rounded-md border px-3 py-[9px] text-xs transition-colors",
                        active && "border-emerald-500/40 bg-emerald-500/10",
                        complete && !active && "border-white/10 bg-white/5 text-muted-foreground",
                        !complete && !active && "border-white/5 bg-black/20 text-muted-foreground/70",
                      )}
                    >
                      <p className="font-semibold text-foreground">
                        {s.question.length > 38 ? s.question.slice(0, 38) + "…" : s.question}
                      </p>
                      {formatSavedAnswer(answers[s.key]) ? (
                        <p className="mt-1 truncate text-[11px] text-emerald-200/90">
                          Saved: {formatSavedAnswer(answers[s.key])}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {}
        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {!done ? (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 font-mono">
                    Step {step + 1}/{steps.length}
                  </span>
                </div>
                <Card className="rounded-[1.75rem] border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="mt-2 text-lg leading-relaxed md:text-xl">{typed}</p>
                      </div>
                    </div>

                    {isWatchlistStep ? (
                      <WatchlistStep
                        sectors={answers.sectors}
                        selectedTickers={selectedTickers}
                        setSelectedTickers={setSelectedTickers}
                        onConfirm={confirmWatchlist}
                        onSkip={skipWatchlist}
                        onBack={step > 0 ? () => setStep((s) => s - 1) : null}
                      />
                    ) : isSectorsStep ? (
                      <div className="space-y-4">
                        <SectorChipSelector
                          value={sectorSelection}
                          onChange={setSectorSelection}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          {step > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full border border-white/10 px-3 text-xs text-muted-foreground hover:border-white/20 hover:text-foreground"
                              onClick={() => setStep((s) => s - 1)}
                            >
                              <ChevronLeft className="mr-1 size-3.5" />
                              Back
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full border-white/15 px-4 text-xs"
                            onClick={skipSectors}
                          >
                            Skip
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 px-4 text-xs"
                            onClick={confirmSectors}
                          >
                            Continue{sectorSelection.length ? ` (${sectorSelection.length})` : ""}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {step > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full border border-white/10 px-3 text-xs text-muted-foreground hover:border-white/20 hover:text-foreground"
                            onClick={() => setStep((s) => s - 1)}
                          >
                            <ChevronLeft className="mr-1 size-3.5" />
                            Back
                          </Button>
                        )}
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
                    )}
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
                        <p className="mt-1 text-sm text-muted-foreground">Your first agent scan will start automatically on the dashboard.</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries({
                        "Risk appetite": answers.risk ?? "-",
                        "Horizon": answers.horizon ?? "-",
                        "Sectors": formatSavedAnswer(answers.sectors) ?? "-",
                        "Watchlist": answers.watchlist ?? "-",
                      }).map(([k, v]) => (
                        <div key={k} className="rounded-md border border-white/10 bg-black/30 p-3 text-sm">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p>
                          <p className="mt-1 font-medium">{String(v)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center">
                      <Button
                        size="lg"
                        onClick={goToDashboard}
                        className="rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-8 text-emerald-950"
                      >
                        {redirectCount > 0
                          ? `You'll be redirected to dashboard in ${redirectCount}`
                          : "Redirecting to dashboard…"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                {/* <motion.div
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
                </motion.div> */}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
