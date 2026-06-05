"use client"

import { Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

/**
 * RiskProfileCard - renders user risk profile.
 * Now accepts props instead of reading demo data.
 * Used from PortfolioSummary which already fetches real user data.
 */
export function RiskProfileCard({ riskTolerance = 'moderate', investmentHorizon = 'medium' }) {
  // Map risk_tolerance to a numeric score for the progress bar
  const scoreMap = { conservative: 30, moderate: 55, aggressive: 80 }
  const score = scoreMap[riskTolerance] ?? 55

  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Shield className="size-4 text-blue-300" />
          Risk profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Risk tolerance</span>
            <span className="font-mono text-foreground capitalize">{riskTolerance}</span>
          </div>
          <Progress value={score} className="mt-2 h-2 bg-white/10" />
        </div>
        <p className="text-sm text-muted-foreground capitalize">Horizon: {investmentHorizon}</p>
      </CardContent>
    </Card>
  )
}
