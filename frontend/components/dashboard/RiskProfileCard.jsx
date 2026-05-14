"use client"

import { Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { demoUser } from "@/data/demo-data"

export function RiskProfileCard() {
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
            <span>Composite score</span>
            <span className="font-mono text-foreground">{demoUser.riskScore}</span>
          </div>
          <Progress value={demoUser.riskScore} className="mt-2 h-2 bg-white/10" />
        </div>
        <p className="text-sm text-muted-foreground">{demoUser.riskLabel}</p>
      </CardContent>
    </Card>
  )
}
