"use client"
import { useAuth } from "@/hooks/useAuth"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Activity, PieChart as PieIcon, Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatInr, formatPct } from "@/lib/format"
import { fetchPortfolio, fetchSectorAllocation, useSSEPrices } from "@/lib/api"
import { SectorAllocationChart } from "@/components/charts/SectorAllocationChart"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"



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
  const [positions, setPositions]   = useState([])
  const [sectors, setSectors]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [priceMap, setPriceMap]     = useState({})

  useEffect(() => {
    Promise.all([
      fetchPortfolio(userId),
      fetchSectorAllocation(userId),
    ]).then(([pos, sec]) => {
      setPositions(pos)
      setSectors(sec)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  // Live price updates via SSE
  useSSEPrices((data) => {
    setPriceMap(prev => ({ ...prev, [data.ticker]: data }))
  })

  // Derive totals from positions (merge with live SSE prices)
  const invested = positions.reduce((sum, p) => {
    return sum + Number(p.average_price) * Number(p.quantity)
  }, 0)

  const currentValue = positions.reduce((sum, p) => {
    const livePrice = priceMap[p.ticker]?.price ?? p.current_price
    if (livePrice == null) return sum
    return sum + livePrice * Number(p.quantity)
  }, 0)

  const totalPnl   = currentValue - invested
  const totalPnlPct = invested > 0 ? (totalPnl / invested) * 100 : 0

  const capAnim = useAnimatedNumber(Math.round(currentValue))
  const invAnim = useAnimatedNumber(Math.round(invested))
  const pnlAnim = useAnimatedNumber(Math.round(Math.abs(totalPnl)))

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl bg-white/5 lg:col-span-2" />
        <Skeleton className="h-40 rounded-2xl bg-white/5" />
        <Skeleton className="h-64 rounded-2xl bg-white/5 lg:col-span-3" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Portfolio summary</CardTitle>
          <Activity className="size-4 text-emerald-300" />
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Current value</p>
            <motion.p className="mt-1 font-mono text-2xl font-semibold tracking-tight" layout>
              {formatInr(capAnim)}
            </motion.p>
            <p className="mt-1 text-xs text-muted-foreground">{positions.length} position{positions.length !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Invested</p>
            <motion.p className="mt-1 font-mono text-2xl font-semibold tracking-tight" layout>
              {formatInr(invAnim)}
            </motion.p>
            {currentValue > 0 && (
              <Progress
                value={(invested / currentValue) * 100}
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
              {totalPnl >= 0 ? '+' : '-'}{formatInr(pnlAnim)}
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
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {positions.length === 0
              ? 'No positions yet — add stocks to your portfolio.'
              : `Tracking ${positions.length} holding${positions.length !== 1 ? 's' : ''}.`}
          </p>
          {positions.slice(0, 3).map(p => {
            const livePrice = priceMap[p.ticker]?.price ?? p.current_price
            const pnl_pct = livePrice != null && p.average_price > 0
              ? ((livePrice - Number(p.average_price)) / Number(p.average_price)) * 100
              : null
            return (
              <div key={p.ticker} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.ticker}</span>
                  {pnl_pct != null && (
                    <span className={pnl_pct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                      {formatPct(pnl_pct)}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {p.quantity} × avg {formatInr(Number(p.average_price))}
                </p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03] lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
