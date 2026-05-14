"use client"

import Link from "next/link"
import { Line, LineChart, ResponsiveContainer } from "recharts"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { demoWatchlistRows } from "@/data/demo-data"
import { formatNumber, formatPct } from "@/lib/format"
import { cn } from "@/lib/utils"

function Spark({ data }) {
  const pts = data.map((y, i) => ({ i, y }))
  return (
    <div className="h-10 w-24 min-h-10 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts}>
          <Line type="monotone" dataKey="y" stroke="url(#sp)" strokeWidth={2} dot={false} />
          <defs>
            <linearGradient id="sp" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const sigColor = {
  BUY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  HOLD: "border-blue-500/40 bg-blue-500/10 text-blue-100",
  EXIT: "border-rose-500/40 bg-rose-500/10 text-rose-100",
}

export function WatchlistTable({ rows = demoWatchlistRows }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-white/10 bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-white/10 bg-black/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Signal</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium">Volume</th>
              <th className="px-4 py-3 font-medium">Sentiment</th>
              <th className="px-4 py-3 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const up = row.changePct >= 0
              return (
                <tr
                  key={row.ticker}
                  className="border-b border-white/5 transition-colors hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/watchlist/${row.ticker}`}
                      className="font-semibold text-emerald-200 hover:underline"
                    >
                      {row.ticker}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.exchange}</p>
                  </td>
                  <td className="px-4 py-3 font-mono">{formatNumber(row.price, 2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-mono text-xs",
                        up ? "text-emerald-300" : "text-rose-300",
                      )}
                    >
                      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                      {formatPct(row.changePct)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("rounded-lg text-[11px]", sigColor[row.signal])}>
                      {row.signal}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.confidence}%</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.volume}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs capitalize text-muted-foreground">
                      {row.sentiment === "neutral" ? (
                        <Minus className="size-3.5 text-slate-400" />
                      ) : null}
                      {row.sentiment}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Spark data={row.sparkline} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
