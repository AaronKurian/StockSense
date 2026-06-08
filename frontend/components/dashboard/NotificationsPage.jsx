"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Bell, CheckCheck } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/api"
import { formatTimeAgo } from "@/lib/format"

const typeColor = {
  recommendation: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  trade_executed: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  auto_executed: "border-purple-500/30 bg-purple-500/10 text-purple-200",
  scan_complete: "border-amber-500/30 bg-amber-500/10 text-amber-200",
}

export function NotificationsPage() {
  const { userId } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!userId) return
    fetchNotifications(userId, { limit: 50 })
      .then(d => { if (Array.isArray(d)) setNotifications(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [userId])

  const markRead = async (id) => {
    await markNotificationRead(id).catch(() => {})
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    await markAllNotificationsRead(userId).catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    toast.success('All notifications marked as read')
  }

  const unread = notifications.filter(n => !n.read)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-2 text-sm text-muted-foreground">Agent activity, recommendations, and trade executions.</p>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" size="sm" className="rounded-xl border-white/15" onClick={markAllRead}>
            <CheckCheck className="size-3.5 mr-1.5" /> Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl bg-white/5" />)}</div>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="rounded-xl border border-white/10 bg-black/30">
            <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-emerald-500/20">All ({notifications.length})</TabsTrigger>
            <TabsTrigger value="unread" className="rounded-lg data-[state=active]:bg-emerald-500/20">Unread ({unread.length})</TabsTrigger>
          </TabsList>

          {['all', 'unread'].map(tab => (
            <TabsContent key={tab} value={tab} className="space-y-2">
              {(tab === 'all' ? notifications : unread).length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">
                  <Bell className="size-8 mx-auto mb-3 text-muted-foreground/50" />
                  {tab === 'all' ? 'No notifications yet. Run the agent to generate signals.' : 'All caught up.'}
                </div>
              ) : (
                (tab === 'all' ? notifications : unread).map(n => (
                  <motion.div key={n._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className={`rounded-xl border-white/10 bg-white/[0.03] ${!n.read ? 'ring-1 ring-emerald-500/20' : ''}`} onClick={() => !n.read && markRead(n._id)}>
                      <CardContent className="flex items-start gap-3 p-3">
                        <div className="mt-0.5">
                          {!n.read && <span className="block size-2 rounded-full bg-emerald-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] ${typeColor[n.type] || 'border-white/10'}`}>{n.type?.replace('_', ' ')}</Badge>
                            <span className="text-[11px] text-muted-foreground">{formatTimeAgo(n.created_at)}</span>
                          </div>
                          <p className="text-sm font-medium mt-1">{n.title}</p>
                          {n.message && <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
