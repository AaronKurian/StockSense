"use client"
import { useAuth } from "@/hooks/useAuth"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Activity, PieChart as PieIcon, Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatInr, formatPct, formatDeltaUsd } from "@/lib/format"
import { fetchPortfolioSummary, fetchSectorAllocation, fetchPortfolioIntelligence, fetchPreferences } from "@/lib/api"
import { SectorAllocationChart } from "@/components/charts/SectorAllocationChart"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

function useAnimatedNumber(target, duration = 1200) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - p) ** 3
      setV(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

export function PortfolioSummary() {
  const { userId } = useAuth()
  const [summary, setSummary]     = useState(null)
  const [sectors, setSectors]       = useState([])
  const [intel, setIntel]           = useState(null)
  const [prefs, setPrefs]           = useState(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      fetchPortfolioSummary(userId),
      fetchSectorAllocation(userId),
      fetchPortfolioIntelligence().catch(() => null),
      fetchPreferences(userId).catch(() => null),
    ]).then(([sum, sec, int, pref]) => {
      setSummary(sum)
      setSectors(sec)
      setIntel(int)
      setPrefs(pref)
    }).catch(console.error).finally(() => setLoading(false))
  }, [userId])

  const equityAnim = useAnimatedNumber(Math.round(summary?.total_equity ?? 0))
  const invAnim = useAnimatedNumber(Math.round(summary?.cost_basis ?? 0))
  const pnlAnim = useAnimatedNumber(Math.round(Math.abs(summary?.unrealized_pnl ?? 0)))

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl bg-white/5 lg:col-span-2" />
        <Skeleton className="h-40 rounded-2xl bg-white/5" />
        <Skeleton className="h-64 rounded-2xl bg-white/5 lg:col-span-3" />
      </div>
    )
  }

  const positions = summary?.positions ?? []
  const totalPnl = summary?.unrealized_pnl ?? 0
  const totalPnlPct = summary?.unrealized_pnl_pct ?? 0
  const totalEquity = summary?.total_equity ?? 0

  const largestPosition = positions.length
    ? [...positions].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
    : null
  const largestWeight = largestPosition && totalEquity > 0
    ? ((largestPosition.value ?? 0) / totalEquity) * 100
    : null

  const equitySectors = (intel?.sectors ?? sectors).filter(s => s.sector !== 'Cash')
  const topSectors = [...equitySectors].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 2)
  const cashWeight = intel?.allocation?.cashWeight ?? (
    totalEquity > 0 ? (summary?.virtual_cash ?? 0) / totalEquity : 1
  )

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Portfolio summary</CardTitle>
          <Activity className="size-4 text-emerald-300" />
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Total portfolio value</p>
            <motion.p className="mt-1 font-mono text-2xl font-semibold tracking-tight" layout>
              {formatInr(equityAnim)}
            </motion.p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatInr(summary?.positions_value ?? 0)} invested · {formatInr(summary?.virtual_cash ?? 0)} cash
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Invested</p>
            <motion.p className="mt-1 font-mono text-2xl font-semibold tracking-tight" layout>
              {formatInr(invAnim)}
            </motion.p>
            {totalEquity > 0 && (
              <Progress
                value={((summary?.positions_value ?? 0) / totalEquity) * 100}
                className="mt-3 h-1.5 bg-white/10"
              />
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unrealised P / L</p>
            <motion.p
              className={`mt-1 font-mono text-2xl font-semibold tracking-tight ${totalPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
              layout
            >
              {formatDeltaUsd(totalPnl)}
            </motion.p>
            <p className={`mt-1 text-xs ${totalPnl >= 0 ? 'text-emerald-200/80' : 'text-rose-200/80'}`}>
              {formatPct(totalPnlPct)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Risk profile</CardTitle>
          <Shield className="size-4 text-blue-300" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="capitalize border-blue-500/30 text-blue-200">
              {prefs?.risk_tolerance || 'moderate'} risk
            </Badge>
            {intel?.healthScore != null && (
              <span className="text-xs text-muted-foreground">Health {intel.healthScore}/100</span>
            )}
          </div>
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No positions yet - add stocks or let the agent invest.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {topSectors.map(s => (
                <div key={s.sector} className="flex justify-between">
                  <span className="text-muted-foreground">{s.sector}</span>
                  <span className="font-mono">{Math.round((s.weight ?? 0) * 100)}%</span>
                </div>
              ))}
              {largestPosition && (
                <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 mt-2">
                  <p className="text-muted-foreground">Largest position</p>
                  <p className="font-semibold mt-0.5">
                    {largestPosition.ticker}
                    {largestWeight != null && (
                      <span className="font-mono text-muted-foreground ml-1">({largestWeight.toFixed(1)}%)</span>
                    )}
                  </p>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-white/5">
                <span className="text-muted-foreground">Diversification</span>
                <span className="font-mono">{positions.length} positions · {intel?.allocation?.diversificationScore ?? '-'}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash reserve</span>
                <span className="font-mono">{Math.round(cashWeight * 100)}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03] lg:col-span-3 pb-8">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <PieIcon className="size-4 text-blue-300" />
            Sector allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SectorAllocationChart data={sectors} />
        </CardContent>
      </Card>
    </div>
  )
}
