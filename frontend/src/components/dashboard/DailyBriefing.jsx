"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { fetchDailyBriefing } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDeltaUsd, formatPct } from "@/lib/format"

export function DailyBriefing() {
  const { userId } = useAuth()
  const [briefing, setBriefing] = useState(null)

  useEffect(() => {
    if (!userId) return
    fetchDailyBriefing(userId).then(setBriefing).catch(() => {})
  }, [userId])

  if (!briefing) return null

  const isPositive = briefing.daily_change >= 0

  return (
    <Card className="rounded-2xl border-white/10 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-blue-500/[0.06]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30 ring-1 ring-white/10">
              <Sparkles className="size-4 text-emerald-200" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Today's Briefing</p>
              <p className="text-sm font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", isPositive ? "border-emerald-500/30 text-emerald-200" : "border-rose-500/30 text-rose-200")}>
            {isPositive ? <ArrowUpRight className="size-3 mr-0.5" /> : <ArrowDownRight className="size-3 mr-0.5" />}
            {formatPct(briefing.daily_change_pct)}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Portfolio Value</p>
            <p className="font-mono text-lg font-semibold">${briefing.portfolio_value.toLocaleString()}</p>
            <p className={cn("text-xs font-mono", isPositive ? "text-emerald-300" : "text-rose-300")}>
              {formatDeltaUsd(briefing.daily_change)} today
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Return</p>
            <p className={cn("font-mono text-lg font-semibold", briefing.total_return_pct >= 0 ? "text-emerald-300" : "text-rose-300")}>
              {formatPct(briefing.total_return_pct)}
            </p>
            <p className="text-xs text-muted-foreground">{briefing.positions} positions held</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Agent Activity</p>
            <p className="text-sm font-medium">
              {briefing.todays_trades > 0 ? `${briefing.todays_trades} trade${briefing.todays_trades > 1 ? 's' : ''}` : 'No trades'}
            </p>
            {briefing.todays_trades > 0 && (
              <p className="text-xs text-muted-foreground">
                {briefing.todays_buys > 0 && `${briefing.todays_buys} buy${briefing.todays_buys > 1 ? 's' : ''}`}
                {briefing.todays_buys > 0 && briefing.todays_sells > 0 && ' · '}
                {briefing.todays_sells > 0 && `${briefing.todays_sells} sell${briefing.todays_sells > 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </div>

        {briefing.trade_details?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {briefing.trade_details.map((detail, i) => (
              <Badge key={i} variant="outline" className="text-[10px] border-white/10">{detail}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
