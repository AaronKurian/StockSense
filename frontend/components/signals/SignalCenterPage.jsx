"use client"
import { useAuth } from "@/hooks/useAuth"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Radio, Search, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SignalCard } from "@/components/signals/SignalCard"
import { EmptyState } from "@/components/common/EmptyState"
import { fetchSignals, patchSignalFeedback } from "@/lib/api"
import { emitSignalsChanged, onSignalsChanged, onActionsChanged } from "@/lib/events"



// Map backend recommendation_log → SignalCard shape
function toSignalShape(rec) {
  return {
    id:               rec._id?.toString() ?? rec.ticker,
    ticker:           rec.ticker,
    name:             rec.ticker,
    type:             rec.signal,
    confidence:       Math.round((rec.confidence ?? 0) * 100),
    urgency:          'medium',
    headline:         rec.rationale?.slice(0, 120) ?? '',
    rationale:        rec.rationale ?? '',
    supportingFactors: rec.supporting_factors ?? [],
    risks:            rec.risks ?? [],
    indicators:       [],
    createdAt:        rec.created_at ?? new Date().toISOString(),
    user_action:      rec.user_action ?? null,
  }
}

export function SignalCenterPage() {
  const { userId } = useAuth()
  const [signals, setSignals]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState("")
  const [minConf, setMinConf]   = useState([0])

  useEffect(() => {
    if (!userId) return
    fetchSignals(userId, { limit: 100 })
      .then(recs => setSignals(recs.map(toSignalShape)))
      .catch(err => {
        console.error(err)
        toast.error('Could not load signals', { description: err.message })
      })
      .finally(() => setLoading(false))
  }, [userId])

  // Listen for cross-component changes (e.g. action approved in Actions page)
  useEffect(() => {
    if (!userId) return
    const reload = () => {
      fetchSignals(userId, { limit: 100 })
        .then(recs => setSignals(recs.map(toSignalShape)))
        .catch(() => {})
    }
    const unsub1 = onSignalsChanged(reload)
    const unsub2 = onActionsChanged(reload)
    return () => { unsub1(); unsub2() }
  }, [userId])

  const handleAction = async (action, signal) => {
    const map = { Confirm: 'confirmed', Ignore: 'ignored', Snooze: 'snoozed' }
    const user_action = map[action]
    if (!user_action) return
    setSignals(prev => prev.map(s => s.id === signal.id ? { ...s, user_action } : s))
    try {
      await patchSignalFeedback(signal.id, user_action)
      emitSignalsChanged()
    } catch (err) {
      console.error('feedback patch failed:', err.message)
    }
  }

  const filtered = useMemo(() => {
    return signals.filter(s => {
      if (q && !`${s.ticker} ${s.name}`.toLowerCase().includes(q.toLowerCase())) return false
      if (s.confidence < minConf[0]) return false
      return true
    })
  }, [signals, q, minConf])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Signal center</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every recommendation from the AI pipeline - confidence, rationale, supporting factors, and risks.
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
            <Slider value={minConf} min={0} max={95} step={1} onValueChange={setMinConf} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="cards" className="space-y-4">
        <TabsList className="rounded-md border border-white/10 bg-black/30">
          <TabsTrigger value="cards" className="rounded-lg data-[state=active]:bg-emerald-500/20">Cards</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-lg data-[state=active]:bg-emerald-500/20">Timeline</TabsTrigger>
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
              <SignalCard key={s.id} signal={s} onAction={handleAction} />
            ))
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardContent className="space-y-4 p-5">
              {loading
                ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-md bg-white/5" />)
                : filtered.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm font-semibold">
                        {s.type} {s.ticker}{' '}
                        <span className="font-normal text-muted-foreground">· {s.confidence}%</span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{s.headline}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.user_action && (
                        <Badge variant="outline" className="capitalize border-white/15 text-[10px]">
                          {s.user_action}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                ))
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
