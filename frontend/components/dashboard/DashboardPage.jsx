"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Activity, Radio } from "lucide-react"
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary"
import { SignalCard } from "@/components/signals/SignalCard"
import { MarketPulseCard } from "@/components/signals/MarketPulseCard"
import { WatchlistTable } from "@/components/watchlist/WatchlistTable"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { IntelligencePanel } from "@/components/dashboard/IntelligencePanel"
import { NotificationCard } from "@/components/dashboard/NotificationCard"
import { PwaInstallBanner } from "@/components/layout/PwaInstallBanner"
import { demoMarketPulse, demoNotifications, demoSignals } from "@/data/demo-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardPage() {
  const [booting, setBooting] = useState(true)
  const [signals, setSignals] = useState(demoSignals)

  const previewNotes = useMemo(() => demoNotifications.slice(0, 2), [])

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    toast.message("Demo stream connected", {
      description: "SSE + Web Push wiring is mocked — swap in EventSource later.",
    })
    const id = setInterval(() => {
      toast.info("Agent pulse", { description: "Re-scoring watchlist for intraday drift (demo)." })
    }, 52000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Command center</h1>
            <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
              <Radio className="mr-1 size-3" />
              Live demo
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            Your proactive surface for AI signals, portfolio context, and MongoDB-backed memory — optimized for a
            judge walkthrough.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs text-muted-foreground"
        >
          <Activity className="size-4 text-emerald-300" />
          AI analyzing deltas…
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
                Highest urgency first
              </Badge>
            </div>
            <div className="space-y-4">
              {signals.map((s) => (
                <SignalCard
                  key={s.id}
                  signal={s}
                  onAction={(action) => {
                    if (action === "Ignore") {
                      setSignals((prev) => prev.filter((x) => x.id !== s.id))
                    }
                  }}
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">AI market pulse</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {demoMarketPulse.map((p, i) => (
                <MarketPulseCard key={p.id} pulse={p} index={i} />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Watchlist</h2>
            <WatchlistTable />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="text-base">Realtime feed</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityFeed />
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
              <CardHeader>
                <CardTitle className="text-base">Notification preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {previewNotes.map((n) => (
                  <NotificationCard key={n.id} notification={n} />
                ))}
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
