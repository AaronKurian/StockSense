"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { fetchPortfolioHistory } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: 9999 },
]

export function PortfolioHistoryChart() {
  const { userId } = useAuth()
  const [data, setData] = useState([])
  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetchPortfolioHistory(userId, period)
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [userId, period])

  if (loading) return <Skeleton className="h-64 rounded-2xl bg-white/5" />
  if (!data.length) {
    return (
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          No portfolio history yet. Data accumulates daily.
        </CardContent>
      </Card>
    )
  }

  const values = data.map(d => d.portfolio_value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const latest = values[values.length - 1]
  const first = values[0]
  const change = latest - first
  const changePct = first > 0 ? (change / first) * 100 : 0
  const isPositive = change >= 0

  const width = 600
  const height = 120
  const padding = 2
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })
  const linePath = `M ${points.join(' L ')}`
  const areaPath = `${linePath} L ${width - padding},${height} L ${padding},${height} Z`

  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-emerald-300" /> Portfolio Value
        </CardTitle>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setPeriod(p.days)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-medium transition-all",
                period === p.days ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/30" : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="font-mono text-2xl font-semibold">${latest.toLocaleString()}</span>
          <span className={cn("text-sm font-mono", isPositive ? "text-emerald-300" : "text-rose-300")}>
            {isPositive ? "+" : ""}{change.toFixed(0)} ({changePct.toFixed(2)}%)
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? "#10b981" : "#f43f5e"} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#areaGrad)" />
          <path d={linePath} fill="none" stroke={isPositive ? "#10b981" : "#f43f5e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>{data[0]?.date ? new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
          <span>{data[data.length - 1]?.date ? new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
        </div>
      </CardContent>
    </Card>
  )
}
