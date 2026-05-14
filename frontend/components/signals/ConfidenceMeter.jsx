"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export function ConfidenceMeter({ value, className }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Confidence</span>
        <span className="font-mono text-foreground">{v}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-300"
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}
