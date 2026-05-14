"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Activity, PieChart as PieIcon, Shield } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCompactInr, formatInr, formatPct } from "@/lib/format"
import { demoPortfolio, demoUser } from "@/data/demo-data"
import { SectorAllocationChart } from "@/components/charts/SectorAllocationChart"
import { Progress } from "@/components/ui/progress"

function useAnimatedNumber(target, duration = 1200) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - (1 - p) ** 3
      setV(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

export function PortfolioSummary() {
  const cap = useAnimatedNumber(demoPortfolio.totalCapital)
  const inv = useAnimatedNumber(demoPortfolio.invested)
  const pnl = useAnimatedNumber(demoPortfolio.totalPnl)

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Portfolio summary</CardTitle>
          <Activity className="size-4 text-emerald-300" />
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Total capital</p>
            <motion.p className="mt-1 font-mono text-2xl font-semibold tracking-tight" layout>
              {formatInr(cap)}
            </motion.p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cash {formatCompactInr(demoPortfolio.cash)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Invested</p>
            <motion.p className="mt-1 font-mono text-2xl font-semibold tracking-tight" layout>
              {formatInr(inv)}
            </motion.p>
            <Progress
              value={(demoPortfolio.invested / demoPortfolio.totalCapital) * 100}
              className="mt-3 h-1.5 bg-white/10"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Profit / loss</p>
            <motion.p
              className="mt-1 font-mono text-2xl font-semibold tracking-tight text-emerald-300"
              layout
            >
              +{formatInr(pnl)}
            </motion.p>
            <p className="mt-1 text-xs text-emerald-200/80">{formatPct(demoPortfolio.totalPnlPct)}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Risk profile</CardTitle>
          <Shield className="size-4 text-blue-300" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Agent risk score</span>
              <span className="font-mono text-foreground">{demoUser.riskScore}</span>
            </div>
            <Progress value={demoUser.riskScore} className="mt-2 h-2 bg-white/10" />
          </div>
          <p className="text-sm text-muted-foreground">{demoUser.riskLabel}</p>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-muted-foreground">
            Day P&amp;L{" "}
            <span className="font-mono text-emerald-300">{formatPct(demoPortfolio.dayPnlPct)}</span> on{" "}
            <span className="font-mono">{formatCompactInr(demoPortfolio.dayPnl)}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/10 bg-white/[0.03] lg:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <PieIcon className="size-4 text-blue-300" />
            Sector allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SectorAllocationChart />
        </CardContent>
      </Card>
    </div>
  )
}
