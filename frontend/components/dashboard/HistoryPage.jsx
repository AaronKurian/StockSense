"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { demoLearningInsights, demoPortfolioAnalytics, demoRecommendationHistory } from "@/data/demo-data"
import { SignalAccuracyChart } from "@/components/charts/SignalAccuracyChart"
import { ConfidenceTrendChart } from "@/components/charts/ConfidenceTrendChart"
import { WatchlistPerformanceChart } from "@/components/charts/WatchlistPerformanceChart"
import { AIInsightCard } from "@/components/dashboard/AIInsightCard"
import { formatPct } from "@/lib/format"

const outcomeColor = {
  win: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  loss: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  neutral: "border-white/15 bg-white/5 text-slate-100",
}

export function HistoryPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Recommendation history</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Outcomes + user actions feed <span className="font-mono text-emerald-200">recommendation_log</span> so the
          agent learns what you actually trade on.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Win rate", `${demoPortfolioAnalytics.winRate}%`],
          ["Avg confidence", `${demoPortfolioAnalytics.avgConfidence}%`],
          ["Sharpe (demo)", String(demoPortfolioAnalytics.sharpe)],
          ["Max DD", formatPct(demoPortfolioAnalytics.maxDrawdown)],
        ].map(([k, v]) => (
          <Card key={k} className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-2 font-mono text-2xl font-semibold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Signal accuracy trend</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalAccuracyChart />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Confidence trend (weekly)</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfidenceTrendChart />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Watchlist performance attribution (demo)</CardTitle>
        </CardHeader>
        <CardContent>
          <WatchlistPerformanceChart />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {demoLearningInsights.map((ins, i) => (
          <AIInsightCard key={ins.id} insight={ins} index={i} />
        ))}
      </div>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Logged recommendations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Ticker</th>
                <th className="pb-3 font-medium">Signal</th>
                <th className="pb-3 font-medium">User action</th>
                <th className="pb-3 font-medium">Outcome</th>
                <th className="pb-3 font-medium">P&amp;L</th>
                <th className="pb-3 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {demoRecommendationHistory.map((row) => (
                <tr key={row.id} className="border-t border-white/5">
                  <td className="py-3 text-muted-foreground">{row.date}</td>
                  <td className="py-3 font-semibold">{row.ticker}</td>
                  <td className="py-3">{row.signal}</td>
                  <td className="py-3 capitalize">{row.userAction}</td>
                  <td className="py-3">
                    <Badge variant="outline" className={outcomeColor[row.outcome]}>
                      {row.outcome}
                    </Badge>
                  </td>
                  <td className="py-3 font-mono">{formatPct(row.pnlPct)}</td>
                  <td className="py-3 font-mono">{row.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs text-muted-foreground">
            {demoRecommendationHistory.map((row) => (
              <p key={`${row.id}-note`}>
                <span className="font-semibold text-foreground">{row.ticker}</span>: {row.accuracyNote}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
