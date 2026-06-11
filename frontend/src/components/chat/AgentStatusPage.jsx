"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { fetchAgentStatus } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Brain, Radio, Shield, Zap, TrendingUp, AlertTriangle, Clock } from "lucide-react"
import { formatTimeAgo, formatDateTime } from "@/lib/format"

export function AgentStatusPage() {
  const { userId } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    fetchAgentStatus(userId).then(setStatus).catch(() => {}).finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />)}</div>

  if (!status) return <p className="text-sm text-muted-foreground">Unable to load agent status.</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Agent Status</h1>
        <p className="mt-2 text-sm text-muted-foreground">Real-time view of your AI portfolio manager's activity and configuration.</p>
      </div>

      <Card className="rounded-2xl border-white/10 bg-gradient-to-r from-emerald-500/5 via-transparent to-blue-500/5">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <Badge className={`rounded-lg px-3 py-1 ${status.mode === 'agentic' ? 'bg-purple-500/20 text-purple-200 border-purple-500/30' : 'bg-blue-500/20 text-blue-200 border-blue-500/30'}`}>
            <Brain className="size-3.5 mr-1.5" /> {status.mode === 'agentic' ? 'Agentic' : 'Manual'}
          </Badge>
          <Badge variant="outline" className={status.enabled ? 'border-emerald-500/30 text-emerald-200' : 'border-rose-500/30 text-rose-200'}>
            {status.enabled ? '● Active' : '○ Paused'}
          </Badge>
          {status.scan_in_progress && (
            <Badge className="animate-pulse bg-amber-500/20 text-amber-200 border-amber-500/30">
              <Radio className="size-3 mr-1 animate-spin" /> Scanning...
            </Badge>
          )}
        </CardContent>
      </Card>

      {status.market_data && (
        <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Radio className="size-4 text-cyan-300" /> Market Data</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <Badge variant="outline" className={
              status.market_data.status === 'fresh'
                ? 'border-emerald-500/30 text-emerald-200'
                : status.market_data.status === 'mixed'
                  ? 'border-amber-500/30 text-amber-200'
                  : 'border-rose-500/30 text-rose-200'
            }>
              {status.market_data.status === 'fresh'
                ? `Updated ${status.market_data.age_minutes != null ? `${Math.round(status.market_data.age_minutes)} min ago` : 'recently'}`
                : status.market_data.status === 'stale'
                  ? `Stale (${status.market_data.age_minutes != null ? `${Math.round(status.market_data.age_minutes)} min` : 'unknown'})`
                  : status.market_data.status === 'mixed'
                    ? `Partially stale (${status.market_data.tickers_covered}/${status.market_data.tickers_total} fresh)`
                    : 'Unavailable'}
            </Badge>
            {status.market_data.last_updated_at && (
              <span className="text-xs text-muted-foreground">
                Last refresh: {formatDateTime(status.market_data.last_updated_at)}
              </span>
            )}
            {status.market_data.stale_tickers?.length > 0 && (
              <span className="text-xs text-rose-300/80">
                Stale: {status.market_data.stale_tickers.join(', ')}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="size-4 text-blue-300" /> Last Scan</CardTitle>
        </CardHeader>
        <CardContent>
          {status.last_scan ? (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="font-medium text-sm">{formatDateTime(status.last_scan.completed_at)}</p>
                <p className="text-[10px] text-muted-foreground">{formatTimeAgo(status.last_scan.completed_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tickers Scanned</p>
                <p className="font-medium text-sm">{status.last_scan.tickers_scanned ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recommendations</p>
                <p className="font-medium text-sm">{status.last_scan.recommendations ?? status.last_scan.recommendations_generated ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Executed</p>
                <p className="font-medium text-sm">{status.last_scan.executed ?? status.last_scan.auto_executed ?? 0} trades</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium text-sm">
                  {status.last_scan.duration_ms != null
                    ? `${(status.last_scan.duration_ms / 1000).toFixed(1)}s`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mode</p>
                <p className="font-medium text-sm capitalize">{status.last_scan.mode}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scans run yet. The agent will start automatically.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="size-4 text-amber-300" /> Last 24 Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid gap-4 ${status.mode === 'agentic' ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
            <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
              <p className="font-mono text-2xl font-semibold">{status.last_24h.recommendations}</p>
              <p className="text-xs text-muted-foreground">Recommendations</p>
            </div>
            {status.mode === 'agentic' && status.last_24h.outcomes ? (
              <>
                <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
                  <p className="font-mono text-2xl font-semibold text-emerald-300">{status.last_24h.outcomes.executed}</p>
                  <p className="text-xs text-muted-foreground">Executed</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
                  <p className="font-mono text-2xl font-semibold text-rose-300">{status.last_24h.outcomes.blocked}</p>
                  <p className="text-xs text-muted-foreground">Blocked</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
                  <p className="font-mono text-2xl font-semibold">{status.last_24h.outcomes.monitoring}</p>
                  <p className="text-xs text-muted-foreground">Monitoring</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
                  <p className="font-mono text-2xl font-semibold text-blue-300">{status.last_24h.outcomes.awaiting_execution}</p>
                  <p className="text-xs text-muted-foreground">Awaiting Execution</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
                  <p className="font-mono text-2xl font-semibold text-emerald-300">{status.last_24h.buys}</p>
                  <p className="text-xs text-muted-foreground">Buys</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
                  <p className="font-mono text-2xl font-semibold text-rose-300">{status.last_24h.sells}</p>
                  <p className="text-xs text-muted-foreground">Sells</p>
                </div>
                <div className="rounded-md border border-white/10 bg-black/30 p-3 text-center">
                  <p className="font-mono text-2xl font-semibold">{status.pending_recommendations}</p>
                  <p className="text-xs text-muted-foreground">Pending Approval</p>
                </div>
              </>
            )}
          </div>
          {status.last_24h.recommendations > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(status.last_24h.signals).filter(([, v]) => v > 0).map(([signal, count]) => (
                <Badge key={signal} variant="outline" className="text-xs border-white/15">
                  {signal}: {count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4 text-blue-300" /> Active Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Positions</span>
              <span className="font-mono">{status.portfolio.positions} / {status.portfolio.max_stocks}</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Cash Reserve</span>
              <span className="font-mono">{status.portfolio.cash_reserve_pct}%</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Stop Loss</span>
              <span className="font-mono text-rose-300">-{status.portfolio.stop_loss_pct}%</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Take Profit</span>
              <span className="font-mono text-emerald-300">+{status.portfolio.take_profit_pct}%</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Trailing Stop</span>
              <span className="font-mono">{status.portfolio.trailing_stop_pct}%</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Min Confidence</span>
              <span className="font-mono">{Math.round(status.config.min_confidence * 100)}%</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Max Position Size</span>
              <span className="font-mono">{status.config.max_position_size_pct}%</span>
            </div>
            <div className="flex justify-between text-sm border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Scan Frequency</span>
              <span className="font-mono">{status.config.signal_frequency}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4 text-emerald-300" /> How StockSense Operates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3 items-start">
            <span className="shrink-0 size-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-200 font-bold">1</span>
            <p>Scans your watchlist every <span className="text-foreground font-medium">{status.config.signal_frequency}</span> using AI + market data</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="shrink-0 size-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-200 font-bold">2</span>
            <p>Generates signals with confidence scores (min <span className="text-foreground font-medium">{Math.round(status.config.min_confidence * 100)}%</span>) and validates each against your rules</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="shrink-0 size-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-200 font-bold">3</span>
            <p>{status.mode === 'agentic' ? 'Executes eligible trades automatically, blocks ineligible ones and monitors the rest' : 'Waits for your approval before executing'}</p>
          </div>
          <div className="flex gap-3 items-start">
            <span className="shrink-0 size-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] text-blue-200 font-bold">⚡</span>
            <p>Protects with stop-loss (<span className="text-rose-300">-{status.portfolio.stop_loss_pct}%</span>), take-profit (<span className="text-emerald-300">+{status.portfolio.take_profit_pct}%</span>) and trailing stops</p>
          </div>
          {status.mode === 'agentic' && (
            <div className="flex gap-3 items-start">
              <span className="shrink-0 size-6 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px] text-purple-200 font-bold">♻️</span>
              <p>Rebalances if any sector exceeds target allocation</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
