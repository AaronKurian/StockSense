"use client"

import { motion } from "framer-motion"
import { AlertTriangle, CheckCircle2, Shield, Zap } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfidenceMeter } from "@/components/signals/ConfidenceMeter"
import { cn } from "@/lib/utils"

const tone = {
  BUY: "from-emerald-500/25 via-emerald-500/5 to-transparent border-emerald-500/30",
  HOLD: "from-blue-500/20 via-blue-500/5 to-transparent border-blue-500/25",
  EXIT: "from-rose-500/25 via-rose-500/5 to-transparent border-rose-500/30",
}

export function SignalCard({ signal, onAction }) {
  const handle = (action) => {
    toast.success(`${action} recorded`, {
      description: `${signal.type} ${signal.ticker} - demo UI only.`,
    })
    onAction?.(action, signal)
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card
        className={cn(
          "overflow-hidden rounded-2xl border bg-gradient-to-br shadow-lg transition-shadow hover:shadow-emerald-500/10",
          tone[signal.type],
        )}
      >
        <CardHeader className="space-y-3 pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-lg bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                  {signal.type}
                </Badge>
                <span className="text-2xl font-semibold tracking-tight">
                  {signal.ticker}
                </span>
                <span className="text-sm text-muted-foreground">{signal.name}</span>
              </div>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {signal.headline}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2">
              <Zap className="size-4 text-amber-300" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Urgency</p>
                <p className="text-sm font-medium capitalize">{signal.urgency}</p>
              </div>
            </div>
          </div>
          <ConfidenceMeter value={signal.confidence} />
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="rounded-md border border-white/10 bg-black/25 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Shield className="size-3.5 text-blue-300" />
              AI rationale
            </div>
            <p className="text-sm leading-relaxed">{signal.rationale}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-emerald-300/90">Supporting factors</p>
              <ul className="space-y-2">
                {signal.supportingFactors.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400/90" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-amber-200/90">Risks</p>
              <ul className="space-y-2">
                {signal.risks.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400/90" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {signal.indicators?.length ? (
            <div className="flex flex-wrap gap-2">
              {signal.indicators.map((i) => (
                <span
                  key={i}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {i}
                </span>
              ))}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t border-white/10 bg-black/20 px-4 py-4">
          <Button
            className="rounded-md bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            onClick={() => handle("Confirm")}
          >
            Confirm
          </Button>
          <Button variant="outline" className="rounded-md border-white/15" onClick={() => handle("Ignore")}>
            Ignore
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
