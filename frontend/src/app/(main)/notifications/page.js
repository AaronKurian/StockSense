"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Bell, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { fetchNotifications, deleteNotification, clearAllNotifications, markAllNotificationsRead } from "@/lib/api"
import { emitNotificationsChanged } from "@/lib/events"
import { formatTimeAgo } from "@/lib/format"

const typeColor = {
  recommendation: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  trade_executed: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  auto_executed: "border-purple-500/30 bg-purple-500/10 text-purple-200",
  scan_complete: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  rebalancing: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
  blocked: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  test: "border-white/15 bg-white/5 text-muted-foreground",
}

export default function NotificationsPage() {
  useEffect(() => { document.title = "Notifications - StockSense" }, [])
  const router = useRouter()
  const { userId } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!userId) return
    fetchNotifications(userId, { limit: 100 })
      .then(d => { if (Array.isArray(d)) setNotifications(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!userId) return
    load()

    markAllNotificationsRead(userId).then(() => emitNotificationsChanged()).catch(() => {})

  }, [userId])

  const handleDelete = async (id) => {
    setNotifications(prev => prev.filter(n => n._id !== id))
    try {
      await deleteNotification(id)
      emitNotificationsChanged()
    } catch {
      load()
    }
  }

  const handleClearAll = async () => {
    if (!userId) return
    setNotifications([])
    try {
      await clearAllNotifications(userId)
      emitNotificationsChanged()
      toast.success('All notifications cleared')
    } catch {
      toast.error('Failed to clear')
      load()
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-2 text-sm text-muted-foreground">Agent activity, recommendations and trade executions.</p>
        </div>
        {notifications.length > 0 && (
          <Button variant="outline" size="sm" className="rounded-md border-white/15 text-rose-300 hover:bg-rose-500/10" onClick={handleClearAll}>
            <Trash2 className="size-3.5 mr-1.5" /> Clear all
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl bg-white/5" />)}</div>
      ) : notifications.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-16">
          <Bell className="size-8 mx-auto mb-3 text-muted-foreground/50" />
          No notifications yet. Run the agent to generate signals.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <motion.div key={n._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card
                className={`rounded-md border-white/10 bg-white/[0.03] group ${n.url ? "cursor-pointer hover:bg-white/[0.06] transition-colors" : ""}`}
                onClick={() => n.url && router.push(n.url)}
              >
                <CardContent className="flex items-start gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${typeColor[n.type] || 'border-white/10'}`}>{n.type?.replace('_', ' ')}</Badge>
                      <span className="text-[11px] text-muted-foreground">{formatTimeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-sm font-medium mt-1 break-words">{n.title}</p>
                    {n.message ? (
                      <p className="text-xs text-muted-foreground mt-0.5 break-words leading-relaxed whitespace-pre-wrap">{n.message}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(n._id) }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-opacity hover:bg-rose-500/10 hover:text-rose-300 opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
