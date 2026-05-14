"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function MarketPulseCard({ pulse, index = 0 }) {
  const sent =
    pulse.sentiment === "constructive"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : pulse.sentiment === "cautious"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-blue-500/30 bg-blue-500/10 text-blue-100"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Card className="rounded-2xl border-white/10 bg-white/[0.03] backdrop-blur-md transition-colors hover:border-emerald-500/20">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold leading-snug">{pulse.title}</CardTitle>
            <Badge variant="outline" className={cn("shrink-0 rounded-lg text-[10px]", sent)}>
              {pulse.sentiment}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="leading-relaxed">{pulse.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {pulse.tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
