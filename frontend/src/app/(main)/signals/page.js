"use client"
import { useAuth } from "@/hooks/useAuth"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Radio, Search, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SignalCard } from "@/components/signals/SignalCard"
import { SignalTimeline } from "@/components/signals/SignalTimeline"
import { EmptyState } from "@/components/common/EmptyState"
import { fetchSignals, fetchPreferences, approveSignal, rejectSignal } from "@/lib/api"
import { emitSignalsChanged, emitActionsChanged, onSignalsChanged, onActionsChanged } from "@/lib/events"
import { toSignalFromRec } from "@/lib/recommendationStatus"

function SignalCenterPageContent() {
  useEffect(() => { document.title = "Signals - StockSense" }, [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightRecId = searchParams.get("recId")
  const highlightTicker = searchParams.get("ticker")
  const { userId } = useAuth()
  const [signals, setSignals] = useState([])
  const [mode, setMode] = useState("manual")
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(highlightTicker ?? "")
  const [minConf, setMinConf] = useState([10])
  const highlightRef = useRef(null)

  useEffect(() => {
    if (highlightRecId) {
      router.replace(`/signals/${highlightRecId}`)
    }
  }, [highlightRecId, router])

  const loadSignals = useCallback(() => {
    if (!userId) return Promise.resolve()
    return fetchSignals(userId, { limit: 100 })
      .then(recs => {
        const latestByTicker = new Map()
        for (const r of recs) {
          const prev = latestByTicker.get(r.ticker)
          if (!prev || new Date(r.created_at) > new Date(prev.created_at)) latestByTicker.set(r.ticker, r)
        }
        setSignals([...latestByTicker.values()].map(r => toSignalFromRec(r, { mode })))
      })
      .catch(err => {
        console.error(err)
        toast.error('Could not load signals', { description: err.message })
      })
  }, [userId, mode])

  useEffect(() => {
    if (!userId) return
    fetchPreferences(userId)
      .then(p => setMode(p?.mode === 'agentic' ? 'agentic' : 'manual'))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    loadSignals().finally(() => setLoading(false))
  }, [userId, loadSignals])

  useEffect(() => {
    if (!userId) return
    const reload = () => { loadSignals().catch(() => {}) }
    const unsub1 = onSignalsChanged(reload)
    const unsub2 = onActionsChanged(reload)
    return () => { unsub1(); unsub2() }
  }, [userId, loadSignals])

  const handleApprove = async (signal) => {
    await approveSignal(signal.id)
    toast.success('Trade approved', { description: `${signal.type} ${signal.ticker} executed.` })
    emitSignalsChanged()
    emitActionsChanged()
    await loadSignals()
  }

  const handleReject = async (signal) => {
    await rejectSignal(signal.id)
    toast.success('Recommendation rejected', { description: `${signal.type} ${signal.ticker} dismissed.` })
    emitSignalsChanged()
    emitActionsChanged()
    await loadSignals()
  }

  const filtered = useMemo(() => {
    return signals.filter(s => {
      if (q && !`${s.ticker} ${s.name}`.toLowerCase().includes(q.toLowerCase())) return false
      if (s.confidence < minConf[0]) return false
      return true
    })
  }, [signals, q, minConf])

  const highlightId = highlightRecId || (highlightTicker
    ? filtered.find(s => s.ticker?.toUpperCase() === highlightTicker.toUpperCase())?.id
    : null)

  useEffect(() => {
    if (!highlightId || loading) return
    const t = setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150)
    return () => clearTimeout(t)
  }, [highlightId, loading, filtered.length])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Signals</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {mode === 'agentic'
            ? 'AI portfolio operations - decisions are executed automatically and recorded here.'
            : 'AI recommendations awaiting your approval - approve to execute or reject to dismiss.'}
        </p>
      </div>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ticker…"
                className="h-11 rounded-md border-white/10 bg-black/30 pl-10"
              />
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <SlidersHorizontal className="size-3.5" />
              Minimum confidence: <span className="font-mono text-foreground">{minConf[0]}%</span>
            </div>
            <Slider
              value={minConf}
              min={0}
              max={95}
              step={1}
              onValueChange={(v) => setMinConf([typeof v === 'number' ? v : v[0] ?? 0])}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="cards" className="space-y-4">
        <TabsList className="rounded-md border border-white/10 bg-black/30">
          <TabsTrigger value="cards" className="rounded-sm cursor-pointer data-[state=active]:bg-emerald-500/20">Cards</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-sm cursor-pointer data-[state=active]:bg-emerald-500/20">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl bg-white/5" />)
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No signals match filters"
              description="Lower the confidence threshold or clear the search."
              actionLabel="Clear filters"
              actionHref="/signals"
            />
          ) : (
            filtered.map(s => (
              <div
                key={s.id}
                ref={s.id === highlightId ? highlightRef : undefined}
                className={s.id === highlightId ? "rounded-2xl ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background" : undefined}
              >
                <SignalCard
                  signal={s}
                  mode={mode}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="timeline" className="pt-2">
          {loading ? (
            <div className="space-y-6 pl-5">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl bg-white/5" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No signals match filters"
              description="Lower the confidence threshold or clear the search."
              actionLabel="Clear filters"
              actionHref="/signals"
            />
          ) : (
            <SignalTimeline signals={filtered} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function SignalCenterPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8">
        <Skeleton className="h-10 w-48 bg-white/5" />
        <Skeleton className="h-32 rounded-2xl bg-white/5" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl bg-white/5" />)}
      </div>
    }>
      <SignalCenterPageContent />
    </Suspense>
  )
}
