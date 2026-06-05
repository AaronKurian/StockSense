"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Activity, Radio } from "lucide-react"
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary"
import { SignalCard } from "@/components/signals/SignalCard"
import { WatchlistTable } from "@/components/watchlist/WatchlistTable"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { IntelligencePanel } from "@/components/dashboard/IntelligencePanel"
import { PwaInstallBanner } from "@/components/layout/PwaInstallBanner"
import { fetchSignals, patchSignalFeedback } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

const USER_ID = 'verify-user'

// Map backend recommendation_log shape → SignalCard shape
function toSignalShape(rec) {
  return {
    id:               rec._id?.toString() ?? rec.ticker,
    ticker:           rec.ticker,
    name:             rec.ticker,           // no name field in DB
    type:             rec.signal,
    confidence:       Math.round((rec.confidence ?? 0) * 100),
    urgency:          'medium',             // backend doesn't store urgency yet
    headline:         rec.rationale?.slice(0, 120) ?? '',
    rationale:        rec.rationale ?? '',
    supportingFactors: rec.supporting_factors ?? [],
    risks:            rec.risks ?? [],
    indicators:       [],
    createdAt:        rec.created_at ?? new Date().toISOString(),
  }
}

export function DashboardPage() {
  const [booting, setBooting]   = useState(true)
  const [signals, setSignals]   = useState([])
  const [loadingSignals, setLoadingSignals] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    fetchSignals(USER_ID, { limit: 10 })
      .then(recs => setSignals(recs.map(toSignalShape)))
      .catch(err => {
        console.error(err)
        toast.error('Could not load signals', { description: err.message })
      })
      .finally(() => setLoadingSignals(false))
  }, [])

  const handleSignalAction = async (action, signal) => {
    const actionMap = { Confirm: 'confirmed', Ignore: 'ignored', Snooze: 'snoozed' }
    const user_action = actionMap[action]
    if (!user_action) return

    if (action === 'Ignore') {
      setSignals(prev => prev.filter(s => s.id !== signal.id))
    }

    try {
      await patchSignalFeedback(signal.id, user_action)
    } catch (err) {
      console.error('feedback patch failed:', err.message)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Command center</h1>
            <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
              <Radio className="mr-1 size-3" />
              Live
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            AI signals, portfolio context, and MongoDB-backed memory — all live.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs text-muted-foreground"
        >
          <Activity className="size-4 text-emerald-300" />
          SSE stream active
        </motion.div>
      </div>

      {booting ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-2xl bg-white/5 lg:col-span-2" />
          <Skeleton className="h-40 rounded-2xl bg-white/5" />
          <Skeleton className="h-64 rounded-2xl bg-white/5 lg:col-span-3" />
        </div>
      ) : (
        <PortfolioSummary />
      )}

      <div className="grid gap-8 xl:grid-cols-[1fr_360px] xl:items-start">
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight">Active signals</h2>
              <Badge variant="outline" className="rounded-full border-white/15 text-xs text-muted-foreground">
                Latest first
              </Badge>
            </div>
            {loadingSignals ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : signals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No signals yet — run the agent to generate recommendations.
              </p>
            ) : (
              <div className="space-y-4">
                {signals.map(s => (
                  <SignalCard key={s.id} signal={s} onAction={handleSignalAction} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Watchlist</h2>
            <WatchlistTable />
          </section>

          <section className="grid gap-4 lg:grid-cols-1">
            <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="text-base">Realtime feed</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityFeed />
              </CardContent>
            </Card>
          </section>
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-24 space-y-4">
            <IntelligencePanel />
          </div>
        </div>
      </div>

      <div className="xl:hidden">
        <IntelligencePanel />
      </div>

      <PwaInstallBanner />
    </div>
  )
}
