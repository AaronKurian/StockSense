"use client"
import { useAuth } from "@/hooks/useAuth"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchWatchlists, fetchWatchlistItems, useSSEPrices } from "@/lib/api"
import { formatNumber, formatPct } from "@/lib/format"
import { cn } from "@/lib/utils"



const sigColor = {
  BUY:      "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  HOLD:     "border-blue-500/40 bg-blue-500/10 text-blue-100",
  EXIT:     "border-rose-500/40 bg-rose-500/10 text-rose-100",
  WATCH:    "border-amber-500/40 bg-amber-500/10 text-amber-100",
  REBALANCE:"border-purple-500/40 bg-purple-500/10 text-purple-100",
}

export function WatchlistTable() {
  const { userId } = useAuth()
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [priceMap, setPriceMap] = useState({})

  useEffect(() => {
    fetchWatchlists(userId)
      .then(lists => {
        if (!lists.length) { setLoading(false); return }
        // Use the first watchlist
        return fetchWatchlistItems(lists[0]._id, userId)
      })
      .then(items => { if (items) setRows(items) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Live price overlay via SSE
  useSSEPrices((data) => {
    setPriceMap(prev => ({ ...prev, [data.ticker]: data }))
  })

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl bg-white/5" />)}
      </div>
    )
  }

  if (!rows.length) {
    return (
      <Card className="rounded-2xl border-white/10 bg-white/[0.03] p-6 text-center text-sm text-muted-foreground">
        No watchlist items yet.
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-white/10 bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-white/10 bg-black/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Ticker</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Signal</th>
              <th className="px-4 py-3 font-medium">Confidence</th>
              <th className="px-4 py-3 font-medium">Volume</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const live         = priceMap[row.ticker]
              const price        = live?.price          ?? row.price        ?? null
              const changePct    = live?.change_percent ?? row.change_percent ?? null
              const volume       = live?.volume         ?? row.volume       ?? null
              const up           = changePct != null ? changePct >= 0 : null

              return (
                <tr key={row.ticker} className="border-b border-white/5 transition-colors hover:bg-white/[0.04]">
                  <td className="px-4 py-3">
                    <Link href={`/watchlist/${row.ticker}`} className="font-semibold text-emerald-200 hover:underline">
                      {row.ticker}
                    </Link>
                    {row.sector && <p className="text-xs text-muted-foreground">{row.sector}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {price != null ? formatNumber(price, 2) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {changePct != null ? (
                      <span className={cn("inline-flex items-center gap-1 font-mono text-xs", up ? "text-emerald-300" : "text-rose-300")}>
                        {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                        {formatPct(changePct)}
                      </span>
                    ) : <Minus className="size-3.5 text-muted-foreground" />}
                  </td>
                  <td className="px-4 py-3">
                    {row.signal ? (
                      <Badge variant="outline" className={cn("rounded-lg text-[11px]", sigColor[row.signal.type] ?? '')}>
                        {row.signal.type}
                      </Badge>
                    ) : <span className="text-muted-foreground text-xs">-</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.signal ? `${row.signal.confidence}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {volume != null ? Number(volume).toLocaleString('en-IN') : '-'}
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
