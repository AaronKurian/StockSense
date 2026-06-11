"use client"

import { SignalCard } from "@/components/signals/SignalCard"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

export function AgentDecisionsList({ signals, mode, loading, onApprove, onReject }) {
  const showActionsCol = mode === "manual" && signals.some(
    (s) => s.status === "generated" && (s.type === "BUY" || s.type === "EXIT")
  )

  if (loading) {
    return (
      <ScrollArea className="h-[320px] rounded-2xl border border-white/10 bg-black/25 pr-3">
        <div className="space-y-2 p-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-md bg-white/5" />
          ))}
        </div>
      </ScrollArea>
    )
  }

  if (!signals.length) {
    return (
      <div className="flex h-[160px] items-center justify-center rounded-2xl border border-white/10 bg-black/25 px-6 text-center text-sm text-muted-foreground">
        {mode === "agentic"
          ? "No agent decisions yet. Click \"Run Agent Scan\" to analyze your watchlist."
          : "No signals yet. Click \"Run Agent Scan\" to generate recommendations."}
      </div>
    )
  }

  const colWidths = showActionsCol
    ? ["15%", "20%", "20%", "23%", "20%", "15%"]
    : ["15%", "22%", "20%", "23%", "20%"]

  const table = (
    <table className="w-full table-fixed text-sm">
      <colgroup>
        {colWidths.map((width, i) => (
          <col key={i} style={{ width }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-10 border-b border-white/10 bg-black/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-4 py-3 font-medium">Status</th>
          <th className="px-4 py-3 font-medium">Ticker</th>
          <th className="px-4 py-3 font-medium">Signal Generated</th>
          <th className="px-4 py-3 font-medium">Confidence Score</th>
          <th className="px-4 py-3 font-medium">Time</th>
          {showActionsCol && <th className="px-4 py-3 text-right font-medium">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {signals.map((s) => (
          <SignalCard
            key={s.id}
            signal={s}
            mode={mode}
            compact
            showActionsCol={showActionsCol}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </tbody>
    </table>
  )

  return (
    <ScrollArea className="h-[320px] rounded-2xl border border-white/10 bg-black/25 pr-3">
      <div className="overflow-x-auto">{table}</div>
    </ScrollArea>
  )
}
