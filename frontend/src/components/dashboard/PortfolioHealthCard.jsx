"use client"

import { Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const scoreStyle = (score) => {
  if (score >= 75) return { text: "text-emerald-400", ring: "stroke-emerald-500", label: "Healthy", labelClass: "text-emerald-300", subtitle: "Balanced across key risk metrics" }
  if (score >= 50) return { text: "text-amber-300", ring: "stroke-amber-500", label: "Fair", labelClass: "text-amber-200", subtitle: "Some metrics below target" }
  return { text: "text-rose-400", ring: "stroke-rose-500", label: "At Risk", labelClass: "text-rose-300", subtitle: "Multiple metrics need attention" }
}

const METRICS = [
  { key: "diversification", label: "Diversification" },
  { key: "concentration", label: "Concentration" },
  { key: "cashReserve", label: "Cash reserve" },
  { key: "sectorBalance", label: "Sector balance" },
]

function BreakdownRow({ label, value }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}/100</span>
    </div>
  )
}

export function PortfolioHealthCard({ intel }) {
  if (!intel) return null

  const score = intel.healthScore ?? 0
  const breakdown = intel.healthBreakdown
  const { text, ring, label, labelClass, subtitle } = scoreStyle(score)

  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="size-4 text-blue-300" />
          Portfolio Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="relative flex size-14 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="2.5"
                pathLength="100"
                strokeDasharray={`${score} 100`}
                className={ring}
              />
            </svg>
            <div className="flex flex-col items-center">
              <span className={`font-mono text-lg font-bold leading-none ${text}`}>{score}</span>
              <span className="text-[9px] text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${labelClass}`}>{label}</p>
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {breakdown && (
          <div className="space-y-1.5 border-t border-white/5 pt-3">
            {METRICS.map(({ key, label: metricLabel }) => (
              <BreakdownRow key={key} label={metricLabel} value={breakdown[key] ?? "-"} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
