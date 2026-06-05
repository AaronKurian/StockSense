"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StockHeader } from "@/components/watchlist/StockHeader"
import { AIReasoningPanel } from "@/components/signals/AIReasoningPanel"
import { RecommendationBreakdown } from "@/components/signals/RecommendationBreakdown"
import { fetchLatestPrice, fetchSignals, useSSEPrices } from "@/lib/api"
import { formatPct, formatTimeAgo } from "@/lib/format"

const USER_ID = 'verify-user'

// Map recommendation_log → SignalCard-compatible shape
function toSignalShape(rec) {
  return {
    id:               rec._id?.toString(),
    ticker:           rec.ticker,
    type:             rec.signal,
    confidence:       Math.round((rec.confidence ?? 0) * 100),
    rationale:        rec.rationale ?? '',
    supportingFactors: rec.supporting_factors ?? [],
    risks:            rec.risks ?? [],
    createdAt:        rec.created_at,
    user_action:      rec.user_action ?? null,
  }
}

export function WatchlistDetailPage({ ticker }) {
  const upper = ticker?.toUpperCase() ?? 'AAPL'
  const [price, setPrice]       = useState(null)
  const [signals, setSignals]   = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetchLatestPrice(upper).catch(() => null),
      fetchSignals(USER_ID, { limit: 20 }).then(recs =>
        recs.filter(r => r.ticker === upper).map(toSignalShape)
      ).catch(() => []),
    ]).then(([p, sigs]) => {
      setPrice(p)
      setSignals(sigs)
    }).finally(() => setLoading(false))
  }, [upper])

  // SSE live price overlay
  useSSEPrices((data) => {
    if (data.ticker === upper) {
      setPrice(prev => ({ ...prev, ...data }))
    }
  })

  const primary = signals[0] ?? null

  // Build a stock shape for StockHeader
  const stock = {
    ticker:    upper,
    name:      upper,
    exchange:  'US',
    sector:    'Technology',
    price:     price?.price ?? null,
    changePct: price?.change_percent ?? 0,
    volume:    price?.volume ? `${(price.volume / 1e6).toFixed(1)}M` : '—',
    pe:        '—',
    mcapCr:    0,
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-2xl bg-white/5" />
        <Skeleton className="h-64 rounded-2xl bg-white/5" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-emerald-300">
          ← Back to dashboard
        </Link>
        <Badge variant="outline" className="rounded-full border-white/15 text-xs">
          Watchlist intelligence
        </Badge>
      </div>

      <StockHeader stock={stock} signal={primary} />

      <Tabs defaultValue="reasoning" className="space-y-4">
        <TabsList className="rounded-xl border border-white/10 bg-black/30">
          {["reasoning", "history"].map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-lg capitalize data-[state=active]:bg-emerald-500/20"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="reasoning" className="space-y-4">
          {primary ? (
            <>
              <AIReasoningPanel
                rationale={primary.rationale}
                factors={primary.supportingFactors}
                risks={primary.risks}
              />
              <RecommendationBreakdown signal={primary} />
            </>
          ) : (
            <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
              <CardContent className="p-6 text-sm text-muted-foreground">
                No signal generated for {upper} yet — run the agent to analyse this ticker.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">Recommendation history ({upper})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {signals.length === 0 ? (
                <p className="text-muted-foreground">No logged recommendations for this ticker.</p>
              ) : (
                signals.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {s.type} · {s.confidence}%
                      </span>
                      <span className="text-[11px] text-muted-foreground">{formatTimeAgo(s.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{s.rationale?.slice(0, 150)}</p>
                    {s.user_action && (
                      <Badge variant="outline" className="mt-2 capitalize border-white/15 text-[10px]">
                        {s.user_action}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
