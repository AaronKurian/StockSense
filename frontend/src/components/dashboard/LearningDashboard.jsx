"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { fetchConfidenceCalibration, fetchSignalPerformance } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Brain, Target, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

export function LearningDashboard() {
  const { userId } = useAuth()
  const [calibration, setCalibration] = useState([])
  const [performance, setPerformance] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      fetchConfidenceCalibration(userId).catch(() => []),
      fetchSignalPerformance(userId).catch(() => ({})),
    ]).then(([cal, perf]) => {
      setCalibration(cal)
      setPerformance(perf)
    }).finally(() => setLoading(false))
  }, [userId])

  if (loading) return <Skeleton className="h-64 rounded-2xl bg-white/5" />

  const hasData = calibration.some(c => c.total > 0) || Object.keys(performance).length > 0

  if (!hasData) {
    return (
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="flex flex-col items-center justify-center h-48 text-center">
          <Brain className="size-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Learning data accumulates after 7+ days of agent activity.</p>
          <p className="text-xs text-muted-foreground mt-1">The agent tracks every recommendation's real-world outcome.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="size-4 text-blue-300" /> Agent Confidence Accuracy
          </CardTitle>
          <p className="text-xs text-muted-foreground">How often the agent's confidence predicts actual outcomes</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {calibration.filter(c => c.total > 0).map(c => (
            <div key={c.range} className="flex items-center gap-3">
              <span className="text-xs font-mono w-16 text-muted-foreground">{c.range}</span>
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", c.accuracy >= 70 ? "bg-emerald-500" : c.accuracy >= 50 ? "bg-amber-500" : "bg-rose-500")}
                  style={{ width: `${c.accuracy || 0}%` }}
                />
              </div>
              <span className="text-xs font-mono w-12 text-right">
                {c.accuracy != null ? `${c.accuracy}%` : '-'}
              </span>
              <span className="text-[10px] text-muted-foreground w-16 text-right">
                ({c.total} signals)
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {}
      {Object.keys(performance).length > 0 && (
        <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-emerald-300" /> Signal Performance (7-day)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(performance).map(([signal, data]) => (
                <div key={signal} className="rounded-md border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">{signal}</Badge>
                    <span className={cn("font-mono text-sm", data.avg_return >= 0 ? "text-emerald-300" : "text-rose-300")}>
                      {data.avg_return >= 0 ? "+" : ""}{data.avg_return}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                    <div>
                      <p>Success</p>
                      <p className="font-mono text-xs text-foreground">{data.success_rate}%</p>
                    </div>
                    <div>
                      <p>Best</p>
                      <p className="font-mono text-xs text-emerald-300">+{data.best}%</p>
                    </div>
                    <div>
                      <p>Worst</p>
                      <p className="font-mono text-xs text-rose-300">{data.worst}%</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{data.total} recommendations tracked</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
