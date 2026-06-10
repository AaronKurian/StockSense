"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Clock, Shield, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { fetchActionsPending, fetchActionsCompleted, approveAction, rejectAction } from "@/lib/api"
import { emitActionsChanged, emitSignalsChanged } from "@/lib/events"
import { formatTimeAgo } from "@/lib/format"

const signalColor = {
  BUY: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  HOLD: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  EXIT: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  WATCH: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  REBALANCE: "border-purple-500/30 bg-purple-500/10 text-purple-100",
}

const statusColor = {
  executed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  rejected: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  expired: "border-white/15 bg-white/5 text-muted-foreground",
}

function PendingCard({ rec, onApprove, onReject }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={signalColor[rec.signal] || ''}>{rec.signal}</Badge>
              <span className="text-lg font-semibold">{rec.ticker}</span>
              <span className="text-xs text-muted-foreground">{formatTimeAgo(rec.created_at)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Shield className="size-3.5 text-blue-300" />
              <span className="font-mono">{rec.confidence != null ? `${Math.round(rec.confidence * 100)}%` : '-'}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{rec.rationale?.slice(0, 200)}</p>

          {rec.supporting_factors?.length > 0 && (
            <div className="space-y-1">
              {rec.supporting_factors.slice(0, 3).map((f, i) => (
                <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}

          {rec.risks?.length > 0 && (
            <div className="space-y-1">
              {rec.risks.slice(0, 2).map((r, i) => (
                <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-400 mt-0.5" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-white/10">
            <Button size="sm" className="rounded-md bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={() => onApprove?.(rec._id)}>
              <CheckCircle2 className="size-3.5 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="rounded-md border-white/15" onClick={() => onReject?.(rec._id)}>
              <XCircle className="size-3.5 mr-1" /> Reject
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function CompletedCard({ rec }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={signalColor[rec.signal] || ''}>{rec.signal}</Badge>
              <span className="text-lg font-semibold">{rec.ticker}</span>
              <span className="text-xs text-muted-foreground">{formatTimeAgo(rec.created_at)}</span>
            </div>
            <Badge variant="outline" className={statusColor[rec.status] || 'border-white/10'}>
              {rec.status === 'executed' || rec.status === 'approved' ? 'Executed' : rec.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{rec.rationale?.slice(0, 150)}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="size-3 text-blue-300" />
            <span className="font-mono">{rec.confidence != null ? `${Math.round(rec.confidence * 100)}%` : '-'}</span>
            {rec.executed_at && <span>· Executed {formatTimeAgo(rec.executed_at)}</span>}
            {rec.rejected_at && <span>· Rejected {formatTimeAgo(rec.rejected_at)}</span>}
            {rec.expired_at && <span>· Expired {formatTimeAgo(rec.expired_at)}</span>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function ActionCenterPage() {
  useEffect(() => { document.title = "Actions - StockSense" }, [])
  const { userId } = useAuth()
  const [pending, setPending] = useState([])
  const [completed, setCompleted] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    if (!userId) return
    try {
      const [p, c] = await Promise.all([
        fetchActionsPending(userId),
        fetchActionsCompleted(userId),
      ])
      setPending(Array.isArray(p) ? p : [])
      setCompleted(Array.isArray(c) ? c : [])
    } catch {
      toast.error('Failed to load actions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [userId])

  const handleApprove = async (id) => {
    try {
      await approveAction(id)
      toast.success('Trade executed')
      fetchAll()
      emitActionsChanged()
      emitSignalsChanged()
    } catch (err) {
      toast.error(err.message || 'Approval failed')
    }
  }

  const handleReject = async (id) => {
    try {
      await rejectAction(id)
      toast.success('Recommendation rejected')
      fetchAll()
      emitActionsChanged()
      emitSignalsChanged()
    } catch {
      toast.error('Reject failed')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Action Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review AI recommendations. Approve to execute a virtual trade, or reject to dismiss.
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="rounded-md border border-white/10 bg-black/30">
          <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-emerald-500/20">
            <Clock className="size-3.5 mr-1.5" /> Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg data-[state=active]:bg-emerald-500/20">
            <CheckCircle2 className="size-3.5 mr-1.5" /> Completed ({completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {loading ? [...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl bg-white/5" />) :
            pending.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No pending recommendations. Run the agent to generate signals.</p> :
            pending.map(rec => <PendingCard key={rec._id} rec={rec} onApprove={handleApprove} onReject={handleReject} />)
          }
        </TabsContent>

        <TabsContent value="completed" className="space-y-3">
          {loading ? [...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />) :
            completed.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No completed actions yet.</p> :
            completed.map(rec => <CompletedCard key={rec._id} rec={rec} />)
          }
        </TabsContent>
      </Tabs>
    </div>
  )
}
