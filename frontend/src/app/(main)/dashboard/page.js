"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { Activity, DollarSign, TrendingUp, Zap, Radio, PieChart, Clock } from "lucide-react"
import { PortfolioSummary } from "@/components/dashboard/PortfolioSummary"
import { PortfolioHealthCard } from "@/components/dashboard/PortfolioHealthCard"
import { DailyBriefing } from "@/components/dashboard/DailyBriefing"
import { PortfolioHistoryChart } from "@/components/charts/PortfolioHistoryChart"
import { LearningDashboard } from "@/components/dashboard/LearningDashboard"
import { SignalCard } from "@/components/signals/SignalCard"
import { WatchlistTable } from "@/components/watchlist/WatchlistTable"
import { ActivityFeed } from "@/components/dashboard/ActivityFeed"
import { PwaInstallBanner } from "@/components/layout/PwaInstallBanner"
import { fetchSignals, patchSignalFeedback, fetchDashboardMetrics, fetchPortfolioIntelligence, agentScan } from "@/lib/api"
import { emitSignalsChanged, emitActionsChanged, onSignalsChanged, onActionsChanged } from "@/lib/events"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPct } from "@/lib/format"

function toSignalShape(rec) {
  return {
    id: rec._id?.toString() ?? rec.ticker,
    ticker: rec.ticker, name: rec.ticker, type: rec.signal,
    confidence: Math.round((rec.confidence ?? 0) * 100),
    urgency: 'medium', headline: rec.rationale?.slice(0, 120) ?? '',
    rationale: rec.rationale ?? '', supportingFactors: rec.supporting_factors ?? [],
    risks: rec.risks ?? [], indicators: [], createdAt: rec.created_at,
  }
}

export default function DashboardPage() {
  useEffect(() => { document.title = "Dashboard - StockSense" }, [])
  const { userId } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [signals, setSignals] = useState([])
  const [intel, setIntel] = useState(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [scanning, setScanning] = useState(false)

  const refresh = useCallback(() => {
    if (!userId) return
    fetchDashboardMetrics(userId).then(setMetrics).catch(() => {}).finally(() => setLoadingMetrics(false))
    fetchSignals(userId, { limit: 5 }).then(recs => setSignals(recs.map(toSignalShape))).catch(() => {}).finally(() => setLoadingSignals(false))
    fetchPortfolioIntelligence().then(d => { if (d.healthScore != null) setIntel(d) }).catch(() => {})
  }, [userId])

  useEffect(() => {
    refresh()

    const unsub1 = onSignalsChanged(refresh)
    const unsub2 = onActionsChanged(refresh)
    return () => { unsub1(); unsub2() }
  }, [refresh])

  const runScan = async () => {
    setScanning(true)
    try {
      await agentScan(userId)
      toast.success('Scan complete - check Actions for new signals')
      refresh()
      emitActionsChanged()
      emitSignalsChanged()
    } catch { toast.error('Scan failed') }
    finally { setScanning(false) }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Command Center</h1>
            <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
              <Radio className="mr-1 size-3" /> Live
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">AI-powered investment operations - signals, portfolio, and autonomous execution.</p>
        </div>
        <Button onClick={runScan} disabled={scanning} className="rounded-md bg-gradient-to-r from-emerald-500 to-blue-500 shadow-lg">
          <Zap className="size-4 mr-1.5" /> {scanning ? 'Scanning…' : 'Run Agent Scan'}
        </Button>
      </div>

      {loadingMetrics ? (
        <div className="grid gap-3 md:grid-cols-5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-md bg-white/5" />)}</div>
      ) : metrics && (
        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: 'Portfolio Value', value: `$${metrics.equity?.toLocaleString()}`, icon: PieChart, color: 'text-blue-300' },
            { label: 'Cash Available', value: `$${metrics.virtual_cash?.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-300' },
            { label: 'Return', value: formatPct(metrics.portfolio_return_pct), icon: TrendingUp, color: metrics.portfolio_return_pct >= 0 ? 'text-emerald-300' : 'text-rose-300' },
            { label: 'Win Rate', value: `${metrics.win_rate}%`, icon: Activity, color: 'text-amber-200' },
            { label: 'Pending', value: String(metrics.pending_actions), icon: Zap, color: 'text-purple-300' },
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

      {intel && intel.sectors?.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Sector Allocation</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {intel.sectors.map(s => (
                  <div key={s.sector} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{s.sector}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-emerald-500/30 w-20">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.round(s.weight * 100)}%` }} />
                      </div>
                      <span className="font-mono w-8 text-right">{Math.round(s.weight * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Portfolio Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Cash Allocation</span><span className="font-mono">{Math.round((intel.allocation?.cashWeight || 0) * 100)}%</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Equity Allocation</span><span className="font-mono">{Math.round((intel.allocation?.equityWeight || 0) * 100)}%</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Positions</span><span className="font-mono">{intel.allocation?.positionCount || 0}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Diversification</span><span className="font-mono">{intel.allocation?.diversificationScore || 0}/100</span></div>
              {intel.performance?.bestPerformer && (
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Top Gainer</span><span className="font-mono text-emerald-300">{intel.performance.bestPerformer} +{intel.performance.bestPerformerPct}%</span></div>
              )}
              {intel.performance?.worstPerformer && (
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Top Loser</span><span className="font-mono text-rose-300">{intel.performance.worstPerformer} {intel.performance.worstPerformerPct}%</span></div>
              )}
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Return</span><span className={`font-mono ${(intel.performance?.totalReturnPct || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPct(intel.performance?.totalReturnPct || 0)}</span></div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Rebalancing Warnings</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {intel.warnings?.length > 0 ? intel.warnings.map((w, i) => (
                <div key={i} className={`rounded-lg border px-2.5 py-1.5 text-xs ${w.severity === 'critical' || w.severity === 'high' ? 'border-amber-500/30 bg-amber-500/5 text-amber-200' : 'border-white/10 text-muted-foreground'}`}>
                  {w.message}
                </div>
              )) : <p className="text-xs text-muted-foreground">No rebalancing warnings.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="">
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Agent Learning</h2>
            <LearningDashboard />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Latest Signals</h2>
            {loadingSignals ? (
              [...Array(2)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl bg-white/5" />)
            ) : signals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No signals yet. Click &quot;Run Agent Scan&quot; to generate recommendations.</p>
            ) : (
              signals.map(s => <SignalCard key={s.id} signal={s} onAction={(action, signal) => {
                const map = { Confirm: 'confirmed', Ignore: 'ignored', Snooze: 'snoozed' }
                if (map[action]) patchSignalFeedback(signal.id, map[action]).then(() => emitSignalsChanged()).catch(() => {})
                if (action === 'Ignore') setSignals(prev => prev.filter(x => x.id !== signal.id))
              }} />)
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Watchlist</h2>
            <WatchlistTable />
          </section>

          <section>
            <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
              <CardHeader><CardTitle className="text-base">Agent Activity</CardTitle></CardHeader>
              <CardContent><ActivityFeed /></CardContent>
            </Card>
          </section>
        </div>
      </div>

      <div className="xl:hidden">
        <PortfolioHealthCard intel={intel} />
      </div>
      <PwaInstallBanner />
    </div>
  )
}
