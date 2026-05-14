"use client"

import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StockHeader } from "@/components/watchlist/StockHeader"
import { PriceChart } from "@/components/charts/PriceChart"
import { Timeline } from "@/components/watchlist/Timeline"
import { AIReasoningPanel } from "@/components/signals/AIReasoningPanel"
import { RecommendationBreakdown } from "@/components/signals/RecommendationBreakdown"
import {
  demoRecommendationHistory,
  demoReasoningTimeline,
  getNewsForTicker,
  getSignalsForTicker,
  getStockByTicker,
} from "@/data/demo-data"
import { formatPct } from "@/lib/format"

export function WatchlistDetailPage({ ticker }) {
  const upper = ticker?.toUpperCase() ?? "INFY"
  const stock = getStockByTicker(upper)
  const signals = getSignalsForTicker(upper)
  const primary = signals[0]
  const news = getNewsForTicker(upper)
  const history = demoRecommendationHistory.filter((h) => h.ticker === upper)

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

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList className="rounded-xl border border-white/10 bg-black/30">
          {["chart", "reasoning", "history", "news"].map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-lg capitalize data-[state=active]:bg-emerald-500/20"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="chart" className="space-y-4">
          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">Price action (demo series)</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceChart ticker={upper} />
            </CardContent>
          </Card>
          <RecommendationBreakdown signal={primary} />
        </TabsContent>
        <TabsContent value="reasoning" className="space-y-4">
          <AIReasoningPanel
            rationale={
              primary?.rationale ??
              "No active signal — agent is monitoring liquidity pockets and sector rotation for a fresh hypothesis."
            }
            factors={primary?.supportingFactors ?? ["Watch rules armed", "Memory snapshot healthy"]}
            risks={primary?.risks ?? ["Event calendar sparse this week"]}
          />
          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">Reasoning timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline items={demoReasoningTimeline} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">Recommendation history ({upper})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {history.length === 0 ? (
                <p className="text-muted-foreground">No logged outcomes for this ticker in the demo set.</p>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {h.signal} · {h.userAction}
                      </span>
                      <span className="font-mono text-xs text-emerald-200">{formatPct(h.pnlPct)}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{h.accuracyNote}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="news">
          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardHeader>
              <CardTitle className="text-base">Related news</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {news.map((n) => (
                <div key={n.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.source} · {n.time}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
