"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, Info, X, Zap } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfidenceMeter } from "@/components/signals/ConfidenceMeter"
import { STATUS_BADGE_STYLES } from "@/lib/recommendationStatus"
import { formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

const tone = {
  BUY: {
    card: "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent",
    accent: "bg-emerald-500",
    badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  },
  HOLD: {
    card: "border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent",
    accent: "bg-blue-500",
    badge: "border-blue-500/40 bg-blue-500/15 text-blue-200",
  },
  EXIT: {
    card: "border-rose-500/25 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent",
    accent: "bg-rose-500",
    badge: "border-rose-500/40 bg-rose-500/15 text-rose-200",
  },
}

const statusDot = {
  PENDING_APPROVAL: "bg-amber-400",
  AWAITING_EXECUTION: "bg-amber-400",
  MONITORING: "bg-blue-400",
  EXECUTED_AUTOMATICALLY: "bg-emerald-400",
  EXECUTED_MANUALLY: "bg-emerald-400",
  REJECTED: "bg-slate-400",
  EXPIRED: "bg-slate-500",
  BLOCKED: "bg-rose-400",
  APPROVED: "bg-emerald-400",
  UNKNOWN: "bg-slate-500",
}

function formatTimestamp(value) {
  if (!value) return null
  const d = new Date(value)
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return `${date} · ${time}`
}

export function SignalCard({ signal, mode = "manual", onApprove, onReject, compact = false, showActionsCol = false }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const tradeable = signal.type === "BUY" || signal.type === "EXIT"
  const showApproval = mode === "manual" && signal.status === "generated" && tradeable
  const statusStyle = STATUS_BADGE_STYLES[signal.displayStatus] ?? STATUS_BADGE_STYLES.UNKNOWN
  const agentExecuted = mode === "agentic" && signal.displayStatus === "EXECUTED_AUTOMATICALLY"
  const style = tone[signal.type] ?? tone.HOLD
  const timestamp = formatTimestamp(signal.createdAt)

  const handleApprove = async () => {
    try {
      await onApprove?.(signal)
    } catch (err) {
      toast.error("Approve failed", { description: err.message })
    }
  }

  const handleReject = async () => {
    try {
      await onReject?.(signal)
    } catch (err) {
      toast.error("Reject failed", { description: err.message })
    }
  }

  if (compact) {
    const statusLabel = signal.displayStatusShortLabel ?? signal.displayStatusLabel
    return (
      <tr
        className="border-b border-white/5 transition-colors hover:bg-white/[0.04] cursor-pointer"
        onClick={() => router.push(signal.id ? `/signals/${signal.id}` : `/signals?ticker=${encodeURIComponent(signal.ticker)}`)}
      >
        <td className="px-4 py-3">
          {statusLabel && (
            <span
              className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px]", statusStyle)}
              title={signal.displayStatusLabel}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[signal.displayStatus] ?? statusDot.UNKNOWN)} />
              <span className="truncate">{statusLabel}</span>
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-base font-semibold tracking-tight">{signal.ticker}</td>
        <td className="px-4 py-3">
          <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", style.badge)}>
            {signal.type}
          </Badge>
        </td>
        <td className="px-4 py-3 font-mono text-sm tabular-nums text-muted-foreground">{signal.confidence}%</td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatTimeAgo(signal.createdAt)}</td>
        {showActionsCol && (
          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
            {showApproval ? (
              <div className="inline-flex gap-1">
                <button
                  type="button"
                  onClick={handleApprove}
                  className="flex size-6 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 transition-colors hover:bg-emerald-500/20"
                  aria-label="Approve"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  className="flex size-6 items-center justify-center rounded-md border border-white/15 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10"
                  aria-label="Reject"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
          </td>
        )}
      </tr>
    )
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <article
        className={cn(
          "overflow-hidden rounded-2xl border shadow-lg transition-shadow hover:shadow-emerald-500/5",
          style.card,
        )}
      >
        <div className={cn("h-0.5 w-full", style.accent)} />

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", style.badge)}>
                  {signal.type}
                </Badge>
                {signal.displayStatusLabel && (
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px]", statusStyle)}>
                    <span className={cn("size-1.5 rounded-full", statusDot[signal.displayStatus] ?? statusDot.UNKNOWN)} />
                    {signal.displayStatusLabel}
                  </span>
                )}
                {signal.contextBadge && (
                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] text-amber-100">
                    {signal.contextBadge.label}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-2xl font-semibold tracking-tight">{signal.ticker}</h3>
                <span className="text-sm text-muted-foreground">{signal.name}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Urgency</p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-xs font-medium capitalize text-amber-300">
                <Zap className="size-3.5" />
                {signal.urgency}
              </p>
            </div>
          </div>

          <p className="text-sm truncate leading-relaxed text-muted-foreground">
            {signal.rationale}
          </p>

          {signal.displayStatus === 'BLOCKED' && signal.blockedHint && (
            <p className="rounded-lg border border-rose-500/25 bg-rose-500/5 px-3 py-2 text-xs text-rose-100/90">
              {signal.blockedHint}
            </p>
          )}

          <ConfidenceMeter value={signal.confidence} label="AI CONFIDENCE" timestamp={timestamp} />

          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex w-full items-center justify-center cursor-pointer gap-1.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          >
            {expanded ? (
              <>Collapse analysis <ChevronUp className="size-3.5" /></>
            ) : (
              <>View full analysis <ChevronDown className="size-3.5" /></>
            )}
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      <Info className="size-3.5 text-blue-300" />
                      AI reasoning
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{signal.rationale}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="border-l-2 border-emerald-500/60 pl-4">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">Supporting</p>
                      <ul className="space-y-2.5">
                        {signal.supportingFactors.map((f) => (
                          <li key={f} className="flex gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400/90" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="border-l-2 border-amber-500/60 pl-4">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">Risks</p>
                      <ul className="space-y-2.5">
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {(showApproval || agentExecuted) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              {showApproval && (
                <>
                  <Button
                    className="rounded-md bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                    onClick={handleApprove}
                  >
                    Approve
                  </Button>
                  <Button variant="outline" className="rounded-md border-white/15" onClick={handleReject}>
                    Reject
                  </Button>
                </>
              )}
              {agentExecuted && (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                  <CheckCircle2 className="size-4" />
                  Agent Executed
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    </motion.div>
  )
}
