"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const tone = {
  BUY: {
    node: "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.55)]",
    badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    bar: "bg-gradient-to-r from-emerald-600 to-emerald-400",
    pct: "text-emerald-300",
  },
  WATCH: {
    node: "bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.55)]",
    badge: "border-blue-500/40 bg-blue-500/15 text-blue-200",
    bar: "bg-gradient-to-r from-blue-600 to-blue-400",
    pct: "text-blue-300",
  },
  HOLD: {
    node: "bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.55)]",
    badge: "border-blue-500/40 bg-blue-500/15 text-blue-200",
    bar: "bg-gradient-to-r from-blue-600 to-blue-400",
    pct: "text-blue-300",
  },
  EXIT: {
    node: "bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.55)]",
    badge: "border-rose-500/40 bg-rose-500/15 text-rose-200",
    bar: "bg-gradient-to-r from-rose-600 to-rose-400",
    pct: "text-rose-300",
  },
  REBALANCE: {
    node: "bg-purple-500 shadow-[0_0_14px_rgba(168,85,247,0.55)]",
    badge: "border-purple-500/40 bg-purple-500/15 text-purple-200",
    bar: "bg-gradient-to-r from-purple-600 to-purple-400",
    pct: "text-purple-300",
  },
}

function formatTimestamp(value) {
  if (!value) return ""
  const d = new Date(value)
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return `${date} · ${time}`
}

function TimelineItem({ signal, isLast, index }) {
  const [expanded, setExpanded] = useState(false)
  const style = tone[signal.type] ?? tone.HOLD
  const fullText = signal.rationale || signal.headline || ""
  const isLong = fullText.length > 120

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex gap-5"
    >
      <div className="relative flex w-4 shrink-0 flex-col items-center">
        {!isLast && <div className="absolute top-4 -bottom-4 w-px bg-white/10" />}
        <div className={cn("relative z-10 mt-4 size-3.5 shrink-0 rounded-full", style.node)} />
      </div>

      <article className="mb-2 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1a1f2b]/80 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", style.badge)}>
            {signal.type}
          </Badge>
          <span className="text-base font-semibold tracking-tight">{signal.ticker}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {formatTimestamp(signal.createdAt)}
          </span>
        </div>

        <div className="mt-3">
          <AnimatePresence initial={false} mode="wait">
            <motion.p
              key={expanded ? "full" : "short"}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              className={cn(
                "text-sm leading-relaxed text-muted-foreground",
                !expanded && isLong && "line-clamp-2",
              )}
            >
              {fullText}
            </motion.p>
          </AnimatePresence>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="mt-1.5 text-[11px] cursor-pointer font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full rounded-full transition-all duration-500", style.bar)}
              style={{ width: `${Math.min(100, Math.max(0, signal.confidence))}%` }}
            />
          </div>
          <span className={cn("shrink-0 font-mono text-sm font-semibold", style.pct)}>
            {signal.confidence}%
          </span>
        </div>
      </article>
    </motion.div>
  )
}

export function SignalTimeline({ signals }) {
  return (
    <div className="relative pl-1">
      {signals.map((s, i) => (
        <TimelineItem
          key={s.id}
          signal={s}
          index={i}
          isLast={i === signals.length - 1}
        />
      ))}
    </div>
  )
}
