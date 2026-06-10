"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain, GitBranch } from "lucide-react"

export function AIReasoningPanel({ title = "Explainability", rationale, factors = [], risks = [] }) {
  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Brain className="size-4 text-blue-300" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="leading-relaxed text-muted-foreground">{rationale}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-medium text-emerald-200/90">
              <GitBranch className="size-3.5" />
              Supporting factors
            </p>
            <ul className="space-y-1.5 text-muted-foreground">
              {factors.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-amber-200/90">Risks</p>
            <ul className="space-y-1.5 text-muted-foreground">
              {risks.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-amber-400">⚠</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
