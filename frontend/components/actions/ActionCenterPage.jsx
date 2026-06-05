"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, XCircle, Zap, Clock, Shield, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { formatTimeAgo, formatPct } from "@/lib/format"

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const signalColor = {
  BUY: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  HOLD: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  EXIT: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  WATCH: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  REBALANCE: "border-purple-500/30 bg-purple-500/10 text-purple-100",
}

function ActionCard({ rec, onApprove, onReject, onExecute, showActions = true }) {
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
              <span className="font-mono">{rec.confidence != null ? `${Math.round(rec.confidence * 100)}%` : '—'}</span>
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

          {rec.status && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] border-white/10 capitalize">{rec.status}</Badge>
              {rec.executed_at && <span className="text-[10px] text-muted-foreground">Executed {formatTimeAgo(rec.executed_at)}</span>}
            </div>
          )}

          {showActions && (
            <div className="flex gap-2 pt-2 border-t border-white/10">
              <Button size="sm" className="rounded-xl bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={() => onApprove?.(rec._id)}>
                <CheckCircle2 className="size-3.5 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="rounded-xl border-white/15" onClick={() => onReject?.(rec._id)}>
                <XCircle className="size-3.5 mr-1" /> Reject
              </Button>
              {(rec.signal === 'BUY' || rec.signal === 'EXIT') && (
                <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => onExecute?.(rec._id)}>
                  <Zap className="size-3.5 mr-1" /> Execute
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function ActionCenterPage() {
  const { userId } = useAuth()
  const [pending, setPending] = useState([])
  const [approved, setApproved] = useState([])
  const [executed, setExecuted] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    if (!userId) return
    try {
      const [p, a, e] = await Promise.all([
        fetch(`${BASE}/api/actions/pending?userId=${userId}`).then(r => r.json()),
        fetch(`${BASE}/api/actions/approved?userId=${userId}`).then(r => r.json()),
        fetch(`${BASE}/api/actions/executed?userId=${userId}`).then(r => r.json()),
      ])
      setPending(Array.isArray(p) ? p : [])
      setApproved(Array.isArray(a) ? a : [])
      setExecuted(Array.isArray(e) ? e : [])
    } catch (err) {
      toast.error('Failed to load actions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [userId])

  const handleApprove = async (id) => {
    try {
      await fetch(`${BASE}/api/actions/${id}/approve`, { method: 'POST' })
      toast.success('Recommendation approved')
      fetchAll()
    } catch { toast.error('Approve failed') }
  }

  const handleReject = async (id) => {
    try {
      await fetch(`${BASE}/api/actions/${id}/reject`, { method: 'POST' })
      toast.success('Recommendation rejected')
      fetchAll()
    } catch { toast.error('Reject failed') }
  }

  const handleExecute = async (id) => {
    try {
      const res = await fetch(`${BASE}/api/actions/${id}/execute`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Execution failed'); return }
      toast.success('Trade executed')
      fetchAll()
    } catch { toast.error('Execute failed') }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Action Center</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review, approve, and execute AI-generated recommendations. Your investment operations command post.
        </p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="rounded-xl border border-white/10 bg-black/30">
          <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-emerald-500/20">
            <Clock className="size-3.5 mr-1.5" /> Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="rounded-lg data-[state=active]:bg-emerald-500/20">
            <CheckCircle2 className="size-3.5 mr-1.5" /> Approved ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="executed" className="rounded-lg data-[state=active]:bg-emerald-500/20">
            <Zap className="size-3.5 mr-1.5" /> Executed ({executed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {loading ? [...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl bg-white/5" />) :
            pending.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No pending recommendations. Run the agent to generate signals.</p> :
            pending.map(rec => <ActionCard key={rec._id} rec={rec} onApprove={handleApprove} onReject={handleReject} onExecute={handleExecute} />)
          }
        </TabsContent>

        <TabsContent value="approved" className="space-y-3">
          {approved.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No approved recommendations yet.</p> :
            approved.map(rec => <ActionCard key={rec._id} rec={rec} showActions={false} onExecute={handleExecute} />)
          }
        </TabsContent>

        <TabsContent value="executed" className="space-y-3">
          {executed.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No executed trades yet.</p> :
            executed.map(rec => <ActionCard key={rec._id} rec={rec} showActions={false} />)
          }
        </TabsContent>
      </Tabs>
    </div>
  )
}
