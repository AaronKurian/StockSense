"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function AIInsightCard({ insight, index = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Card className="rounded-2xl border-white/10 bg-gradient-to-br from-blue-500/10 via-transparent to-emerald-500/10">
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-200/90">
            <Sparkles className="size-3.5" />
            Learning insight
          </div>
          <p className="text-sm font-semibold leading-snug">{insight.title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
