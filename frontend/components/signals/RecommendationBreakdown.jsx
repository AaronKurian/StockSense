"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfidenceMeter } from "@/components/signals/ConfidenceMeter"

export function RecommendationBreakdown({ signal }) {
  if (!signal) return null
  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">Active signal breakdown</CardTitle>
        <Badge variant="outline" className="rounded-lg border-white/15">
          {signal.type}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <ConfidenceMeter value={signal.confidence} />
        <div className="grid gap-3 text-xs md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-muted-foreground">Target zone</p>
            <p className="mt-1 font-mono text-sm">
              {signal.targetZone ? `${signal.targetZone.low} – ${signal.targetZone.high}` : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-muted-foreground">Stop / risk control</p>
            <p className="mt-1 font-mono text-sm">{signal.stopLoss ?? "-"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
