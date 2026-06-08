"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronLeft, Loader2, Search, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { searchStocks, completeOnboarding } from "@/lib/api"

// Sector-to-stock mapping for intelligent suggestions
const sectorStocks = {
  Technology: [
    { ticker: "AAPL", name: "Apple"},
    { ticker: "MSFT", name: "Microsoft"},
    { ticker: "NVDA", name: "NVIDIA"},
    { ticker: "AMD", name: "AMD"},
    { ticker: "GOOGL", name: "Google"},
    { ticker: "META", name: "Meta"},
  ],
  Healthcare: [
    { ticker: "JNJ", name: "Johnson & Johnson"},
    { ticker: "UNH", name: "UnitedHealth"},
    { ticker: "PFE", name: "Pfizer"},
    { ticker: "ABBV", name: "AbbVie"},
    { ticker: "MRK", name: "Merck"},
  ],
  Finance: [
    { ticker: "JPM", name: "JPMorgan"},
    { ticker: "BAC", name: "Bank of America"},
    { ticker: "GS", name: "Goldman Sachs"},
    { ticker: "V", name: "Visa"},
    { ticker: "MA", name: "Mastercard"},
  ],
  Energy: [
    { ticker: "XOM", name: "Exxon Mobil"},
    { ticker: "CVX", name: "Chevron"},
    { ticker: "SHEL", name: "Shell"},
    { ticker: "BP", name: "BP"},
    { ticker: "COP", name: "ConocoPhillips"},
  ],
  Consumer: [
    { ticker: "AMZN", name: "Amazon"},
    { ticker: "COST", name: "Costco"},
    { ticker: "WMT", name: "Walmart"},
    { ticker: "NKE", name: "Nike"},
    { ticker: "MCD", name: "McDonald's"},
  ],
}

const baseSteps = [
  { key: "risk", question: "What is your risk appetite?", chips: ["Conservative", "Moderate", "Aggressive"] },
  { key: "horizon", question: "What is your investment horizon?", chips: ["Short (< 1 year)", "Medium (1-5 years)", "Long (5+ years)"] },
  { key: "sectors", question: "Which sectors interest you?", chips: ["Technology", "Healthcare", "Finance", "Energy", "Consumer"] },
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


// ─── Watchlist Search + Select Step ────────────────────────────────────────────

function WatchlistStep({ sector, selectedTickers, setSelectedTickers, onConfirm, onSkip, onBack }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const debounceRef = useRef(null)
  const abortRef = useRef(null)

  const suggestions = sectorStocks[sector] || sectorStocks.Technology

  const handleSearch = useCallback((value) => {
    setQuery(value)
    setNoResults(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (value.length < 2) {
      setResults([])
      setSearching(false)
      return
    }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const data = await searchStocks(value)
        if (!controller.signal.aborted) {
          setResults(data || [])
          setNoResults(!data?.length)
          setSearching(false)
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([])
          setSearching(false)
        }
      }
    }, 300)
  }, [])

  const toggleTicker = (ticker, name) => {
    setSelectedTickers((prev) => {
      const exists = prev.find((t) => t.ticker === ticker)
      if (exists) return prev.filter((t) => t.ticker !== ticker)
      if (prev.length >= 20) return prev
      return [...prev, { ticker, name }]
    })
  }

  const removeTicker = (ticker) => {
    setSelectedTickers((prev) => prev.filter((t) => t.ticker !== ticker))
  }

  const isSelected = (ticker) => selectedTickers.some((t) => t.ticker === ticker)

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by company name or ticker..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2">
          {results.map((r) => (
            <button
              key={`${r.symbol}-${r.exchange}`}
              onClick={() => toggleTicker(r.symbol, r.name)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                isSelected(r.symbol)
                  ? "bg-emerald-500/20 text-emerald-100"
                  : "hover:bg-white/5"
              )}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">({r.symbol})</span>
                <span className="ml-2 text-xs text-muted-foreground/60">{r.exchange}</span>
              </div>
              {isSelected(r.symbol) && <Check className="size-4 shrink-0 text-emerald-400" />}
            </button>
          ))}
        </div>
      )}

      {noResults && query.length >= 2 && !searching && (
        <p className="text-center text-xs text-muted-foreground">No matching stocks found.</p>
      )}

      {/* Selected Stocks */}
      {selectedTickers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Selected ({selectedTickers.length}/20)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedTickers.map((s) => (
              <span
                key={s.ticker}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200"
              >
                {s.ticker}
                <button
                  onClick={() => removeTicker(s.ticker)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-500/20"
                  aria-label={`Remove ${s.ticker}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sector Suggestions */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Popular {sector || "Technology"} stocks
        </p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((stock) => {
            const selected = isSelected(stock.ticker)
            return (
              <Button
                key={stock.ticker}
                variant="outline"
                size="sm"
                className={cn(
                  "rounded-full px-3 text-xs transition-all",
                  selected
                    ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                    : "border-white/15 bg-black/30 hover:border-emerald-500/40 hover:bg-emerald-500/10"
                )}
                onClick={() => toggleTicker(stock.ticker, stock.name)}
              >
                {stock.name} <span className="text-muted-foreground">({stock.ticker})</span>
                {selected && <Check className="ml-1.5 size-3" />}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Actions */}
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

// ─── Main Onboarding Flow ──────────────────────────────────────────────────────

export function OnboardingFlow() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [selectedTickers, setSelectedTickers] = useState([])
  const [done, setDone] = useState(false)

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
      // Save to backend with the final complete answers
      completeOnboarding({
        risk: updatedAnswers.risk || null,
        horizon: updatedAnswers.horizon || null,
        sectors: updatedAnswers.sectors || null,
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

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-b from-emerald-500/20 via-blue-500/10 to-transparent blur-3xl" />
      </div>
      <div className="relative m-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-12">
        {/* Left Sidebar Progress */}
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
                      {answers[s.key] ? (
                        <p className="mt-1 truncate text-[11px] text-emerald-200/90">
                          Saved: {answers[s.key]}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content */}
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
                        sector={answers.sectors}
                        selectedTickers={selectedTickers}
                        setSelectedTickers={setSelectedTickers}
                        onConfirm={confirmWatchlist}
                        onSkip={skipWatchlist}
                        onBack={step > 0 ? () => setStep((s) => s - 1) : null}
                      />
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
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries({
                        "Risk appetite": answers.risk ?? "-",
                        "Horizon": answers.horizon ?? "-",
                        "Sectors": answers.sectors ?? "-",
                        "Watchlist": answers.watchlist ?? "-",
                      }).map(([k, v]) => (
                        <div key={k} className="rounded-md border border-white/10 bg-black/30 p-3 text-sm">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{k}</p>
                          <p className="mt-1 font-medium">{String(v)}</p>
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
        </div>
      </div>
    </div>
  )
}
