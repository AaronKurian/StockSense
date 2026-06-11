"use client"
import { useAuth } from "@/hooks/useAuth"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
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

export function WatchlistTable({ compact = false }) {
  const { userId } = useAuth()
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [priceMap, setPriceMap] = useState({})

  useEffect(() => {
    if (!userId) return
    fetchWatchlists(userId)
      .then(lists => {
        if (!lists.length) { setLoading(false); return }

        return fetchWatchlistItems(lists[0]._id, userId)
      })
      .then(items => { if (items) setRows(items) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  useSSEPrices((data) => {
    setPriceMap(prev => ({ ...prev, [data.ticker]: data }))
  })

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-md bg-white/5" />)}
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

  const table = (
    <table className="w-full min-w-[700px] text-sm">
      <thead className={cn(
        "border-b border-white/10 bg-black/30 text-left text-xs uppercase tracking-wide text-muted-foreground",
        compact && "sticky top-0 z-10"
      )}>
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
              <td className="px-4 py-3 font-mono" title={price == null ? 'Price data unavailable' : undefined}>
                {price != null ? formatNumber(price, 2) : <span className="text-muted-foreground cursor-help" title="Price data unavailable">-</span>}
              </td>
              <td className="px-4 py-3">
                {changePct != null ? (
                  <span className={cn("inline-flex items-center gap-1 font-mono text-xs", up ? "text-emerald-300" : "text-rose-300")}>
                    {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                    {formatPct(changePct)}
                  </span>
                ) : <span title="Change data unavailable"><Minus className="size-3.5 text-muted-foreground cursor-help" /></span>}
              </td>
              <td className="px-4 py-3">
                {row.signal ? (
                  <Badge variant="outline" className={cn("rounded-lg text-[11px]", sigColor[row.signal.type] ?? '')}>
                    {row.signal.type}
                  </Badge>
                ) : <span className="text-muted-foreground text-xs cursor-help" title="No signal generated yet">-</span>}
              </td>
              <td className="px-4 py-3 font-mono text-xs" title={!row.signal ? 'No signal generated yet' : undefined}>
                {row.signal ? `${row.signal.confidence}%` : <span className="text-muted-foreground cursor-help" title="No signal generated yet">-</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground" title={volume == null ? 'Volume data unavailable' : undefined}>
                {volume != null ? Number(volume).toLocaleString('en-IN') : <span className="cursor-help" title="Volume data unavailable">-</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )

  if (compact) {
    return (
      <ScrollArea className="h-[320px] rounded-2xl border border-white/10 bg-black/25 pr-3">
        <div className="overflow-x-auto">{table}</div>
      </ScrollArea>
    )
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-white/10 bg-white/[0.03]">
      <div className="overflow-x-auto">{table}</div>
    </Card>
  )
}
