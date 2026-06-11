"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { Activity, DollarSign, TrendingUp, Zap, PieChart, Clock } from "lucide-react"
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary"
import { PortfolioHealthCard } from "@/components/dashboard/PortfolioHealthCard"
import { DailyBriefing } from "@/components/dashboard/DailyBriefing"
import { PortfolioHistoryChart } from "@/components/charts/PortfolioHistoryChart"
import { LearningDashboard } from "@/components/dashboard/LearningDashboard"
import { AgentDecisionsList } from "@/components/dashboard/AgentDecisionsList"
import { WatchlistTable } from "@/components/watchlist/WatchlistTable"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { PwaInstallBanner } from "@/components/layout/PwaInstallBanner"
import { fetchSignals, fetchPreferences, approveSignal, rejectSignal, fetchDashboardMetrics, fetchPortfolioIntelligence, agentScan } from "@/lib/api"
import { emitSignalsChanged, emitActionsChanged, onSignalsChanged, onActionsChanged, consumeInitialAgentScan } from "@/lib/events"
import { toSignalFromRec } from "@/lib/recommendationStatus"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPct } from "@/lib/format"

export default function DashboardPage() {
  useEffect(() => { document.title = "Dashboard - StockSense" }, [])
  const { userId } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [signals, setSignals] = useState([])
  const [mode, setMode] = useState("manual")
  const [intel, setIntel] = useState(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [scanning, setScanning] = useState(false)
  const scanInFlight = useRef(false)

  useEffect(() => {
    if (!userId) return
    fetchPreferences(userId)
      .then(p => setMode(p?.mode === "agentic" ? "agentic" : "manual"))
      .catch(() => {})
  }, [userId])

  const refresh = useCallback(() => {
    if (!userId) return
    fetchDashboardMetrics(userId).then(setMetrics).catch(() => {}).finally(() => setLoadingMetrics(false))
    fetchSignals(userId, { limit: 20 }).then(recs => {
      const latestByTicker = new Map()
      for (const r of recs) {
        const prev = latestByTicker.get(r.ticker)
        if (!prev || new Date(r.created_at) > new Date(prev.created_at)) latestByTicker.set(r.ticker, r)
      }
      setSignals(
        [...latestByTicker.values()]
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(r => toSignalFromRec(r, { mode }))
      )
    }).catch(() => {}).finally(() => setLoadingSignals(false))
    fetchPortfolioIntelligence().then(d => { if (d.healthScore != null) setIntel(d) }).catch(() => {})
  }, [userId, mode])

  useEffect(() => {
    refresh()

    const unsub1 = onSignalsChanged(refresh)
    const unsub2 = onActionsChanged(refresh)
    return () => { unsub1(); unsub2() }
  }, [refresh])

  const runScan = useCallback(async () => {
    if (!userId || scanInFlight.current) return
    scanInFlight.current = true
    setScanning(true)
    try {
      await agentScan(userId)
      toast.success(mode === 'agentic' ? 'Scan complete - agent decisions are on your dashboard' : 'Scan complete - review new signals')
      refresh()
      emitActionsChanged()
      emitSignalsChanged()
    } catch {
      toast.error('Scan failed')
    } finally {
      scanInFlight.current = false
      setScanning(false)
    }
  }, [userId, mode, refresh])

  useEffect(() => {
    if (!userId) return
    if (!consumeInitialAgentScan()) return
    runScan()
  }, [userId, runScan])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">StockSense Dashboard</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">AI powered investment operations - signals, portfolio and autonomous execution.</p>
        </div> 
        <div className="flex items-center p-0.5 rounded-md bg-gradient-to-r from-emerald-500 to-blue-500">
          <Button
            onClick={runScan}
            disabled={scanning || !userId}
            className="rounded-sm p-4.5 bg-black shadow-lg disabled:opacity-60"
          >
            <span className="bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent flex items-center">
              <Zap className={`size-4 mr-1.5 text-emerald-500 ${scanning ? 'animate-pulse' : ''}`} />
              {scanning ? 'Scanning…' : 'Run Agent Scan'}
            </span>
          </Button>
        </div>
      </div>

      {loadingMetrics ? (
        <div className="grid gap-3 md:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-md bg-white/5" />)}</div>
      ) : metrics && (
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: 'Portfolio Value', value: `$${metrics.equity?.toLocaleString()}`, icon: PieChart, color: 'text-blue-300' },
            { label: 'Cash', value: `$${metrics.virtual_cash?.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-300' },
            { label: 'Invested', value: `$${(metrics.positions_value ?? 0).toLocaleString()}`, icon: Activity, color: 'text-amber-200' },
            { label: 'Return', value: formatPct(metrics.portfolio_return_pct), icon: TrendingUp, color: metrics.portfolio_return_pct >= 0 ? 'text-emerald-300' : 'text-rose-300' },
          ].map(m => (
            <Card key={m.label} className="rounded-md border-white/10 bg-white/[0.03]">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <m.icon className={`size-4 ${m.color}`} />
                  <span className="text-[11px] text-muted-foreground">{m.label}</span>
                </div>
                <p className="mt-1 font-mono text-lg font-semibold">{m.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {metrics && (
        <Card className="rounded-2xl border-white/10 bg-gradient-to-r from-emerald-500/5 via-transparent to-blue-500/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-4">
            <Badge className={`rounded-lg ${metrics.mode === 'agentic' ? 'bg-purple-500/20 text-purple-200 border-purple-500/30' : 'bg-blue-500/20 text-blue-200 border-blue-500/30'}`}>
              Mode: {metrics.mode}
            </Badge>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              Next scan: {metrics.next_scan ? new Date(metrics.next_scan).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
            </div>
            {metrics.latest_recommendation && (
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px]">{metrics.latest_recommendation.signal} {metrics.latest_recommendation.ticker}</Badge>
                <span className="font-mono">{metrics.latest_recommendation.confidence != null ? `${Math.round(metrics.latest_recommendation.confidence * 100)}%` : ''}</span>
                {metrics.latest_recommendation.confidence_delta != null && (
                  <span className={`font-mono text-[10px] ${metrics.latest_recommendation.confidence_delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {metrics.latest_recommendation.confidence_delta >= 0 ? '↑' : '↓'}{Math.abs(Math.round(metrics.latest_recommendation.confidence_delta * 100))}%
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DailyBriefing />

      <PortfolioHistoryChart />

      <PortfolioSummary />

      {intel && intel.sectors?.length > 0 && (() => {
        const equitySectors = intel.sectors.filter(s => s.sector !== 'Cash').sort((a, b) => b.weight - a.weight)
        const largest = equitySectors[0]
        const smallest = equitySectors.length > 1 ? equitySectors[equitySectors.length - 1] : null
        const cashPct = Math.round((intel.allocation?.cashWeight || 0) * 100)
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Sector Insights</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-xs">
                {largest && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Largest sector</span>
                    <span className="font-mono">{largest.sector} ({Math.round(largest.weight * 100)}%)</span>
                  </div>
                )}
                {smallest && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Smallest holding</span>
                    <span className="font-mono">{smallest.sector} ({Math.round(smallest.weight * 100)}%)</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cash reserve</span>
                  <span className="font-mono">{cashPct}%</span>
                </div>
                {intel.insights?.[0] && (
                  <p className="text-muted-foreground leading-relaxed pt-1 border-t border-white/5">{intel.insights[0]}</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Portfolio Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Cash Allocation</span><span className="font-mono">{cashPct}%</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Equity Allocation</span><span className="font-mono">{Math.round((intel.allocation?.equityWeight || 0) * 100)}%</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Positions</span><span className="font-mono">{intel.allocation?.positionCount || 0}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Diversification</span><span className="font-mono">{intel.allocation?.diversificationScore || 0}/100</span></div>
                {intel.performance?.bestPerformer && (
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Top Gainer</span><span className="font-mono text-emerald-300">{intel.performance.bestPerformer} {formatPct(intel.performance.bestPerformerPct)}</span></div>
                )}
                {intel.performance?.worstPerformer && (
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Top Loser</span><span className="font-mono text-rose-300">{intel.performance.worstPerformer} {formatPct(intel.performance.worstPerformerPct)}</span></div>
                )}
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Return</span><span className={`font-mono ${(intel.performance?.totalReturnPct || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPct(intel.performance?.totalReturnPct || 0)}</span></div>
              </CardContent>
            </Card>

            <PortfolioHealthCard intel={intel} />
          </div>
        )
      })()}

      <div className="">
        <div className="space-y-10">
          {/* <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Agent Learning</h2>
            <LearningDashboard />
          </section> */}

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">{mode === "agentic" ? "Agent Decisions" : "Latest Signals"}</h2>
            <AgentDecisionsList
              signals={signals}
              mode={mode}
              loading={loadingSignals || scanning}
              onApprove={async (signal) => {
                await approveSignal(signal.id)
                toast.success("Trade approved")
                emitSignalsChanged()
                emitActionsChanged()
                refresh()
              }}
              onReject={async (signal) => {
                await rejectSignal(signal.id)
                toast.success("Recommendation rejected")
                emitSignalsChanged()
                emitActionsChanged()
                refresh()
              }}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Watchlist</h2>
            <WatchlistTable compact />
          </section>

          <section>
            <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
              <CardHeader><CardTitle className="text-base">Agent Activity</CardTitle></CardHeader>
              <CardContent><ActivityFeed /></CardContent>
            </Card>
          </section>
        </div>
      </div>

      <PwaInstallBanner />
    </div>
  )
}
