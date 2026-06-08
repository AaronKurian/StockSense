"use client"

import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useSSEPrices } from "@/lib/api"

/**
 * PriceChart - accumulates live SSE price ticks for a ticker.
 * No demo data. Shows real-time price as it comes in.
 * When market is closed, shows "waiting for data" state.
 */
export function PriceChart({ ticker = "AAPL" }) {
  const upper = ticker.toUpperCase()
  const [points, setPoints] = useState([])

  useSSEPrices((data) => {
    if (data.ticker === upper && data.price != null) {
      setPoints(prev => [
        ...prev.slice(-99),
        { i: prev.length, c: Number(data.price) }
      ])
    }
  })

  if (!points.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm text-muted-foreground">
        Waiting for live price ticks via SSE…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">Live price stream · {points.length} tick(s)</p>
      <div className="h-72 w-full min-h-72 min-w-0 rounded-2xl border border-white/10 bg-black/30 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points}>
            <defs>
              <linearGradient id="fillPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="i" tick={false} axisLine={false} />
            <YAxis
              domain={["auto", "auto"]}
              width={56}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(2,6,23,0.92)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
              }}
              formatter={(v) => [`$${v?.toFixed?.(2) ?? v}`, "Price"]}
            />
            <Area type="monotone" dataKey="c" stroke="#34d399" fill="url(#fillPrice)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
