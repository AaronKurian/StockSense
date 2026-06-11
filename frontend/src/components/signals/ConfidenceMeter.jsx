"use client"

import { motion } from "framer-motion"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export function ConfidenceMeter({ value, className, label = "Confidence", timestamp }) {
  const v = Math.min(100, Math.max(0, value))
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {timestamp && <span className="normal-case tracking-normal">{timestamp}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-300"
            initial={{ width: prefersReducedMotion ? `${v}%` : 0 }}
            animate={{ width: `${v}%` }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 120, damping: 20 }
            }
          />
        </div>
        <span className="shrink-0 font-mono text-sm font-semibold text-emerald-300">{v}%</span>
      </div>
    </div>
  )
}
