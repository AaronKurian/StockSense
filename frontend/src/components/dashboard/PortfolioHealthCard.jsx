"use client"

import { motion } from "framer-motion"
import { Shield, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const severityColor = { critical: 'text-rose-400', high: 'text-amber-400', medium: 'text-amber-200', low: 'text-muted-foreground' }
const severityBadge = { critical: 'border-rose-500/30 bg-rose-500/10 text-rose-200', high: 'border-amber-500/30 bg-amber-500/10 text-amber-200', medium: 'border-blue-500/30 bg-blue-500/10 text-blue-200', low: 'border-white/10 text-muted-foreground' }

export function PortfolioHealthCard({ intel }) {
  if (!intel) return null
  const score = intel.healthScore ?? 0
  const color = score >= 75 ? 'text-emerald-400' : score >= 50 ? 'text-amber-300' : 'text-rose-400'
  const ring = score >= 75 ? 'ring-emerald-500/30' : score >= 50 ? 'ring-amber-500/30' : 'ring-rose-500/30'

  return (
    <div className="space-y-4">
      <Card className={`rounded-2xl border-white/10 bg-white/[0.03] ${ring} ring-1`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4 text-blue-300" /> Portfolio Health</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="flex flex-col items-center">
            <span className={`font-mono text-4xl font-bold ${color}`}>{score}</span>
            <span className="text-[10px] text-muted-foreground mt-1">/ 100</span>
          </motion.div>
          <div className="flex-1 space-y-2">
            {intel.warnings?.slice(0, 3).map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                {w.severity === 'high' || w.severity === 'critical' ? <AlertTriangle className={`size-3.5 shrink-0 mt-0.5 ${severityColor[w.severity]}`} /> : w.severity === 'low' ? <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-emerald-400" /> : <Info className="size-3.5 shrink-0 mt-0.5 text-blue-300" />}
                <span className="text-muted-foreground">{w.message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {intel.concentration?.alerts?.length > 0 && (
        <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Concentration Risk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {intel.concentration.alerts.map(a => (
              <div key={a.ticker} className="flex items-center justify-between text-xs">
                <span className="font-semibold">{a.ticker}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{Math.round(a.weight * 100)}%</span>
                  <Badge variant="outline" className={`text-[9px] ${severityBadge[a.level]}`}>{a.level}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {intel.insights?.length > 0 && (
        <Card className="rounded-2xl border-white/10 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Portfolio Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {intel.insights.map((insight, i) => (
              <p key={i} className="text-xs text-muted-foreground leading-relaxed">• {insight}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
