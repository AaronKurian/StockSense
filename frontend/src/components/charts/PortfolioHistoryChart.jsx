"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { fetchPortfolioHistory, fetchTrades } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDeltaUsd, formatPct } from "@/lib/format"

const PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: 9999 },
]

const CHART_WIDTH = 600
const CHART_HEIGHT = 120
const CHART_PADDING = 2
const TRADE_HIT_PX = 18

function timeToX(ts, startMs, endMs, width, padding) {
  const range = endMs - startMs || 1
  const clamped = Math.max(startMs, Math.min(endMs, ts))
  return padding + ((clamped - startMs) / range) * (width - padding * 2)
}

function valueAtTime(data, ts) {
  if (!data.length) return 0
  let best = data[0]
  let bestDiff = Math.abs(new Date(best.date).getTime() - ts)
  for (const pt of data) {
    const diff = Math.abs(new Date(pt.date).getTime() - ts)
    if (diff < bestDiff) {
      best = pt
      bestDiff = diff
    }
  }
  return best.portfolio_value
}

function computeYDomain(values) {
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const mid = (rawMin + rawMax) / 2
  const span = rawMax - rawMin || mid * 0.001 || 1
  const pad = Math.max(span * 0.001, mid * 0.001, 1)
  const min = rawMin - pad
  const max = rawMax + pad
  return { min, max, range: max - min || 1 }
}

function formatSnapshotTime(date, isHourly) {
  if (!date) return ""
  const d = new Date(date)
  if (isHourly) {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      hour12: true,
    })
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatUsd(n) {
  if (n == null || Number.isNaN(n)) return "-"
  return `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function nearestPointIndex(svgX, dataLength, width, padding) {
  const plotWidth = width - padding * 2
  if (plotWidth <= 0 || dataLength <= 1) return 0
  const frac = Math.max(0, Math.min(1, (svgX - padding) / plotWidth))
  return Math.round(frac * (dataLength - 1))
}

function svgToClient(svgX, svgY, rect, width, height) {
  return {
    x: rect.left + (svgX / width) * rect.width,
    y: rect.top + (svgY / height) * rect.height,
  }
}

function clientToSvg(clientX, clientY, rect, width, height) {
  return {
    x: ((clientX - rect.left) / rect.width) * width,
    y: ((clientY - rect.top) / rect.height) * height,
  }
}

function TooltipCard({ children, x, y, containerWidth }) {
  const cardWidth = 168
  const offset = 12
  let left = x + offset
  let top = y - offset
  if (left + cardWidth > containerWidth) left = x - cardWidth - offset
  if (left < 4) left = 4
  if (top < 4) top = y + offset

  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[148px] max-w-[200px] rounded-lg border border-white/10 bg-black/90 px-2.5 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{ left, top, transform: "translateY(-100%)" }}
    >
      {children}
    </div>
  )
}

function PointTooltipContent({ point, startValue, isHourly }) {
  const change = point.portfolio_value - startValue
  const changePct = startValue > 0 ? (change / startValue) * 100 : 0
  const positive = change >= 0

  return (
    <>
      <p className="mb-1.5 font-medium text-foreground/90">{formatSnapshotTime(point.date, isHourly)}</p>
      <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-3">
          <span>Portfolio</span>
          <span className="text-foreground">{formatUsd(point.portfolio_value)}</span>
        </div>
        {point.cash != null && (
          <div className="flex justify-between gap-3">
            <span>Cash</span>
            <span className="text-foreground">{formatUsd(point.cash)}</span>
          </div>
        )}
        {point.positions_value != null && (
          <div className="flex justify-between gap-3">
            <span>Invested</span>
            <span className="text-foreground">{formatUsd(point.positions_value)}</span>
          </div>
        )}
        <div className={cn("flex justify-between gap-3 pt-0.5", positive ? "text-emerald-300" : "text-rose-300")}>
          <span>Since start</span>
          <span>{formatDeltaUsd(change)} ({formatPct(changePct)})</span>
        </div>
      </div>
    </>
  )
}

function TradeTooltipContent({ trade }) {
  const isBuy = trade.action === "BUY"
  const amount = trade.cost ?? Number(trade.quantity) * Number(trade.entry_price)
  const time = new Date(trade.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })

  return (
    <>
      <p className={cn("mb-1 font-semibold", isBuy ? "text-emerald-300" : "text-rose-300")}>
        {trade.action} {trade.ticker}
      </p>
      <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
        <div className="flex justify-between gap-3">
          <span>Time</span>
          <span className="text-foreground">{time}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Shares</span>
          <span className="text-foreground">{Number(trade.quantity).toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Price</span>
          <span className="text-foreground">${Number(trade.entry_price).toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Amount</span>
          <span className="text-foreground">{formatUsd(amount)}</span>
        </div>
      </div>
    </>
  )
}

function PortfolioChartCanvas({ data, trades, isHourly, todayPositive }) {
  const chartRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  const values = data.map(d => d.portfolio_value)
  const { min, max, range } = computeYDomain(values)
  const startValue = values[0]

  const startMs = new Date(data[0].date).getTime()
  const endMs = new Date(data[data.length - 1].date).getTime()

  const points = values.map((v, i) => {
    const x = CHART_PADDING + (i / Math.max(values.length - 1, 1)) * (CHART_WIDTH - CHART_PADDING * 2)
    const y = CHART_HEIGHT - CHART_PADDING - ((v - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2)
    return { x, y, index: i }
  })
  const linePath = `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}`
  const areaPath = `${linePath} L ${CHART_WIDTH - CHART_PADDING},${CHART_HEIGHT} L ${CHART_PADDING},${CHART_HEIGHT} Z`

  const chartTrades = trades.filter(t => {
    const ts = new Date(t.created_at).getTime()
    return ts >= startMs && ts <= endMs + 3600000
  })

  const tradeMarkers = chartTrades.map((t, i) => {
    const ts = new Date(t.created_at).getTime()
    const x = timeToX(ts, startMs, endMs, CHART_WIDTH, CHART_PADDING)
    const val = valueAtTime(data, ts)
    const y = CHART_HEIGHT - CHART_PADDING - ((val - min) / range) * (CHART_HEIGHT - CHART_PADDING * 2)
    return { trade: t, x, y, key: t._id?.toString() ?? i }
  })

  const handlePointer = (clientX, clientY) => {
    const container = chartRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const { x: svgX } = clientToSvg(clientX, clientY, rect, CHART_WIDTH, CHART_HEIGHT)
    const localX = clientX - rect.left
    const localY = clientY - rect.top

    let nearestTrade = null
    let nearestDist = TRADE_HIT_PX
    for (const marker of tradeMarkers) {
      const client = svgToClient(marker.x, marker.y, rect, CHART_WIDTH, CHART_HEIGHT)
      const dist = Math.hypot(clientX - client.x, clientY - client.y)
      if (dist < nearestDist) {
        nearestDist = dist
        nearestTrade = marker
      }
    }

    if (nearestTrade) {
      setTooltip({ kind: "trade", trade: nearestTrade.trade, x: localX, y: localY })
      return
    }

    const index = nearestPointIndex(svgX, data.length, CHART_WIDTH, CHART_PADDING)
    const point = data[index]
    const pt = points[index]
    setTooltip({ kind: "point", point, index, crosshairX: pt?.x, x: localX, y: localY })
  }

  const handlePointerLeave = () => setTooltip(null)

  const formatLabel = (date) => {
    if (!date) return ""
    const d = new Date(date)
    if (isHourly) {
      return d.toLocaleString("en-US", { hour: "numeric", hour12: true })
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div ref={chartRef} className="relative touch-none">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-32 w-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={(e) => handlePointer(e.clientX, e.clientY)}
        onMouseLeave={handlePointerLeave}
        onTouchStart={(e) => {
          const touch = e.touches[0]
          if (touch) handlePointer(touch.clientX, touch.clientY)
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0]
          if (touch) {
            e.preventDefault()
            handlePointer(touch.clientX, touch.clientY)
          }
        }}
        onTouchEnd={handlePointerLeave}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={todayPositive ? "#10b981" : "#f43f5e"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={todayPositive ? "#10b981" : "#f43f5e"} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaGrad)" />
        <path
          d={linePath}
          fill="none"
          stroke={todayPositive ? "#10b981" : "#f43f5e"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {tooltip?.kind === "point" && tooltip.crosshairX != null && (
          <line
            x1={tooltip.crosshairX}
            x2={tooltip.crosshairX}
            y1={CHART_PADDING}
            y2={CHART_HEIGHT - CHART_PADDING}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}
        {tooltip?.kind === "point" && points[tooltip.index] && (
          <circle
            cx={points[tooltip.index].x}
            cy={points[tooltip.index].y}
            r="4"
            fill={todayPositive ? "#10b981" : "#f43f5e"}
            stroke="#0a0a0a"
            strokeWidth="1.5"
          />
        )}
        {tradeMarkers.map(({ trade: t, x, y, key }) => {
          const isBuy = t.action === "BUY"
          const color = isBuy ? "#10b981" : "#f43f5e"
          const active = tooltip?.kind === "trade" && tooltip.trade === t
          return (
            <g key={key}>
              <circle cx={x} cy={y} r={active ? 5 : 4} fill={color} stroke="#0a0a0a" strokeWidth="1.5" />
            </g>
          )
        })}
      </svg>
      {tooltip && (
        <TooltipCard x={tooltip.x} y={tooltip.y} containerWidth={chartRef.current?.offsetWidth ?? 300}>
          {tooltip.kind === "point" ? (
            <PointTooltipContent point={tooltip.point} startValue={startValue} isHourly={isHourly} />
          ) : (
            <TradeTooltipContent trade={tooltip.trade} />
          )}
        </TooltipCard>
      )}
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{formatLabel(data[0]?.date)}</span>
        {data.length > 2 && (
          <span className="flex items-center gap-2 opacity-60">
            <span>{isHourly ? "Hourly" : "Daily"} · {data.length} points</span>
            {chartTrades.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" /> BUY
                <span className="ml-1 inline-block size-1.5 rounded-full bg-rose-500" /> SELL
              </span>
            )}
          </span>
        )}
        <span>{formatLabel(data[data.length - 1]?.date)}</span>
      </div>
    </div>
  )
}

export function PortfolioHistoryChart() {
  const { userId } = useAuth()
  const [data, setData] = useState([])
  const [trades, setTrades] = useState([])
  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    Promise.all([
      fetchPortfolioHistory(userId, period),
      fetchTrades(userId, { limit: 100 }),
    ])
      .then(([history, tradeList]) => {
        setData(Array.isArray(history) ? history : [])
        setTrades(Array.isArray(tradeList) ? tradeList : [])
      })
      .catch(() => { setData([]); setTrades([]) })
      .finally(() => setLoading(false))
  }, [userId, period])

  if (loading) return <Skeleton className="h-64 rounded-2xl bg-white/5" />
  if (!data.length) {
    return (
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No portfolio history yet. Snapshots are recorded hourly.
        </CardContent>
      </Card>
    )
  }

  const isHourly = data.some(d => d.granularity === "hourly") || data.length > 14
  const values = data.map(d => d.portfolio_value)
  const latest = values[values.length - 1]

  const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000
  let baseline24h = data[0]
  for (const pt of data) {
    if (new Date(pt.date).getTime() <= dayAgoMs) baseline24h = pt
  }
  const todayChange = latest - baseline24h.portfolio_value
  const todayChangePct = baseline24h.portfolio_value > 0
    ? (todayChange / baseline24h.portfolio_value) * 100
    : 0

  const first = values[0]
  const periodChange = latest - first
  const periodChangePct = first > 0 ? (periodChange / first) * 100 : 0
  const todayPositive = todayChange >= 0

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
        <div className="mb-3 space-y-1">
          <span className="font-mono text-2xl font-semibold">${latest.toLocaleString()}</span>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-xs">
            <span className={cn(todayPositive ? "text-emerald-300" : "text-rose-300")}>
              Today: {formatDeltaUsd(todayChange)} ({formatPct(todayChangePct)})
            </span>
            <span className={cn(periodChange >= 0 ? "text-emerald-300/80" : "text-rose-300/80")}>
              Since start: {formatDeltaUsd(periodChange)} ({formatPct(periodChangePct)})
            </span>
          </div>
        </div>
        <PortfolioChartCanvas
          data={data}
          trades={trades}
          isHourly={isHourly}
          todayPositive={todayPositive}
        />
      </CardContent>
    </Card>
  )
}
