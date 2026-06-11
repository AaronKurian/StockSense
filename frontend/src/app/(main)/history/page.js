"use client"
import { useAuth } from "@/hooks/useAuth"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchSignalHistory, fetchPreferences } from "@/lib/api"
import { formatDateTime, formatTimeOnly } from "@/lib/format"
import { getDisplayStatus, getDisplayStatusLabel, STATUS_BADGE_STYLES } from "@/lib/recommendationStatus"

const signalColor = {
  BUY:       "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  HOLD:      "border-blue-500/30 bg-blue-500/10 text-blue-100",
  EXIT:      "border-rose-500/30 bg-rose-500/10 text-rose-100",
  WATCH:     "border-amber-500/30 bg-amber-500/10 text-amber-100",
  REBALANCE: "border-purple-500/30 bg-purple-500/10 text-purple-100",
}

function HistoryPageContent() {
  useEffect(() => { document.title = "History - StockSense" }, [])
  const searchParams = useSearchParams()
  const highlightRecId = searchParams.get("recId")
  const highlightRef = useRef(null)
  const { userId } = useAuth()
  const [recs, setRecs]     = useState([])
  const [mode, setMode]     = useState('manual')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    Promise.all([
      fetchSignalHistory(userId, 100),
      fetchPreferences(userId).catch(() => ({ mode: 'manual' })),
    ])
      .then(([signals, prefs]) => {
        setRecs(signals)
        setMode(prefs?.mode === 'manual' ? 'manual' : 'agentic')
      })
      .catch(err => {
        console.error(err)
        toast.error('Could not load history', { description: err.message })
      })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!highlightRecId || loading) return
    const t = setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150)
    return () => clearTimeout(t)
  }, [highlightRecId, loading, recs.length])

  const total       = recs.length
  const avgConf     = total > 0
    ? Math.round(recs.reduce((s, r) => s + (r.confidence ?? 0), 0) / total * 100)
    : 0
  const executed    = recs.filter(r => r.status === 'executed').length
  const rejected    = recs.filter(r => r.status === 'rejected').length

  const stats = [
    ['Total signals',   String(total)],
    ['Avg confidence',  `${avgConf}%`],
    ['Executed',        String(executed)],
    ['Rejected',        String(rejected)],
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Recommendation history</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Complete log of AI decisions, execution results and lifecycle status.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map(([k, v]) => (
          <Card key={k} className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              {loading
                ? <Skeleton className="mt-2 h-8 w-16 bg-white/5" />
                : <p className="mt-2 font-mono text-2xl font-semibold">{v}</p>
              }
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Logged recommendations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 rounded-md bg-white/5" />)}
            </div>
          ) : recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recommendations yet - run the agent pipeline first.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Logged AI recommendations</caption>
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="pb-3 font-medium">Generated</th>
                  <th scope="col" className="pb-3 font-medium">Executed / Checked</th>
                  <th scope="col" className="pb-3 font-medium">Ticker</th>
                  <th scope="col" className="pb-3 font-medium">Signal</th>
                  <th scope="col" className="pb-3 font-medium">Confidence</th>
                  <th scope="col" className="pb-3 font-medium">Status</th>
                  <th scope="col" className="pb-3 font-medium">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((rec) => {
                  const recId = rec._id?.toString()
                  const isHighlighted = highlightRecId && recId === highlightRecId
                  const displayKey = getDisplayStatus(rec, { mode })
                  const label = getDisplayStatusLabel(rec, { mode })
                  const isMonitoring = rec.status === 'generated' && (rec.signal === 'HOLD' || rec.signal === 'WATCH')
                  const followUp = isMonitoring
                    ? (rec.checked_at || rec.updated_at)
                    : rec.executed_at
                  return (
                    <tr
                      key={recId ?? rec.ticker + rec.created_at}
                      ref={isHighlighted ? highlightRef : undefined}
                      className={`border-t border-white/5 ${isHighlighted ? "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30" : ""}`}
                    >
                      <td className="py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(rec.created_at)}
                      </td>
                      <td className="py-3 text-muted-foreground text-xs whitespace-nowrap" title={isMonitoring ? 'Last checked' : 'Executed'}>
                        {followUp ? (
                          <span>
                            {isMonitoring && <span className="text-[10px] opacity-60 block">Checked</span>}
                            {formatTimeOnly(followUp)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-3 font-semibold">{rec.ticker}</td>
                      <td className="py-3">
                        <Badge variant="outline" className={signalColor[rec.signal] ?? ''}>
                          {rec.signal}
                        </Badge>
                      </td>
                      <td className="py-3 font-mono">
                        {rec.confidence != null ? `${Math.round(rec.confidence * 100)}%` : '-'}
                      </td>
                      <td className="py-3">
                        <Badge variant="outline" className={STATUS_BADGE_STYLES[displayKey] ?? ''}>
                          {label}
                        </Badge>
                      </td>
                      <td title={rec.rationale} className="py-3 text-muted-foreground max-w-xs truncate text-xs">
                        {rec.rationale ?? '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-8">
        <Skeleton className="h-10 w-64 bg-white/5" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl bg-white/5" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl bg-white/5" />
      </div>
    }>
      <HistoryPageContent />
    </Suspense>
  )
}
