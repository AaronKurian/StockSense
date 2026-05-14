"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { demoPriceSeries } from "@/data/demo-data"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function PriceChart({ ticker = "INFY" }) {
  const [tf, setTf] = useState("1D")
  const data = useMemo(() => {
    const series = demoPriceSeries[ticker] || demoPriceSeries.INFY
    return series.map((row, i) => ({
      i,
      c: row.c,
      band: row.c + Math.sin(i / 3) * 4,
    }))
  }, [ticker])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tf} onValueChange={setTf}>
          <TabsList className="rounded-xl border border-white/10 bg-black/30">
            {["1H", "1D", "1W", "3M"].map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-100"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-[11px] text-muted-foreground">Demo series · not live market data</p>
      </div>
      <div className="h-72 w-full min-h-72 min-w-0 rounded-2xl border border-white/10 bg-black/30 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
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
              width={48}
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
              formatter={(v) => [v?.toFixed?.(2) ?? v, "Close"]}
            />
            <Area type="monotone" dataKey="c" stroke="#34d399" fill="url(#fillPrice)" strokeWidth={2} />
            <Area type="monotone" dataKey="band" stroke="#38bdf8" fill="none" strokeDasharray="4 4" strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
