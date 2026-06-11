"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Radio } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/useAuth"
import { SignalCard } from "@/components/signals/SignalCard"
import { EmptyState } from "@/components/common/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchSignalsPending, fetchSignalHistory, fetchPreferences, approveSignal, rejectSignal } from "@/lib/api"
import { emitSignalsChanged, emitActionsChanged } from "@/lib/events"
import { toSignalFromRec } from "@/lib/recommendationStatus"

const COMPLETED_STATUSES = new Set(['executed', 'rejected', 'expired', 'approved'])

export default function SignalDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const { userId } = useAuth()
  const [rec, setRec] = useState(null)
  const [mode, setMode] = useState("manual")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId || !id) return
    const [pending, history, prefs] = await Promise.all([
      fetchSignalsPending(userId, 100).catch(() => []),
      fetchSignalHistory(userId, 200).catch(() => []),
      fetchPreferences(userId).catch(() => ({ mode: 'manual' })),
    ])
    setMode(prefs?.mode === 'agentic' ? 'agentic' : 'manual')
    const found = [...pending, ...history].find(r => r._id?.toString() === id)
    if (found && COMPLETED_STATUSES.has(found.status)) {
      router.replace(`/history?recId=${encodeURIComponent(id)}`)
      return
    }
    setRec(found ?? null)
  }, [userId, id, router])

  useEffect(() => { document.title = rec ? `${rec.ticker} Signal - StockSense` : "Signal - StockSense" }, [rec])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    load()
      .catch(err => {
        console.error(err)
        toast.error('Could not load signal', { description: err.message })
      })
      .finally(() => setLoading(false))
  }, [userId, load])

  const handleApprove = async (signal) => {
    await approveSignal(signal.id)
    toast.success('Trade approved', { description: `${signal.type} ${signal.ticker} executed.` })
    emitSignalsChanged()
    emitActionsChanged()
    router.push(`/history?recId=${encodeURIComponent(signal.id)}`)
  }

  const handleReject = async (signal) => {
    await rejectSignal(signal.id)
    toast.success('Recommendation rejected', { description: `${signal.type} ${signal.ticker} dismissed.` })
    emitSignalsChanged()
    emitActionsChanged()
    await load()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-white/5" />
        <Skeleton className="h-48 rounded-2xl bg-white/5" />
      </div>
    )
  }

  if (!rec) {
    return (
      <EmptyState
        icon={Radio}
        title="Signal not found"
        description="This recommendation may have been removed or is no longer available."
        actionLabel="View all signals"
        actionHref="/signals"
      />
    )
  }

  const signal = toSignalFromRec(rec, { mode })

  return (
    <div className="space-y-6">
      <Link href="/signals" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" />
        All signals
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{rec.ticker} signal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Recommendation record {id.slice(0, 8)}…
        </p>
      </div>
      <SignalCard
        signal={signal}
        mode={mode}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  )
}
