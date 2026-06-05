"use client"
import { useAuth } from "@/hooks/useAuth"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Bell } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { NotificationCard } from "@/components/dashboard/NotificationCard"
import { EmptyState } from "@/components/common/EmptyState"
import { fetchSignals, patchSignalFeedback } from "@/lib/api"



// Map a recommendation_log document to the shape NotificationCard expects
function toNotification(rec) {
  return {
    id:      rec._id?.toString() ?? `${rec.ticker}-${rec.created_at}`,
    kind:    rec.signal,                     // BUY | HOLD | EXIT | WATCH | REBALANCE
    title:   `${rec.signal} ${rec.ticker}`,
    body:    rec.rationale?.slice(0, 120) ?? '',
    ticker:  rec.ticker,
    time:    rec.created_at ?? new Date().toISOString(),
    read:    !!rec.user_action,              // treated as read once user acted
    actions: ['confirm', 'dismiss'],
  }
}

export function NotificationsPage() {
  const { userId } = useAuth()
  const [recs, setRecs]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSignals(userId, { limit: 50 })
      .then(setRecs)
      .catch(err => {
        console.error(err)
        toast.error('Could not load notifications', { description: err.message })
      })
      .finally(() => setLoading(false))
  }, [])

  const items  = useMemo(() => recs.map(toNotification), [recs])
  const unread = useMemo(() => items.filter(n => !n.read), [items])

  const handleAction = async (action, notification) => {
    const map = { Confirmed: 'confirmed', Dismissed: 'ignored', Snoozed: 'snoozed' }
    const user_action = map[action]
    if (!user_action) return
    setRecs(prev => prev.map(r =>
      r._id?.toString() === notification.id ? { ...r, user_action } : r
    ))
    try {
      await patchSignalFeedback(notification.id, user_action)
    } catch (err) {
      console.error('feedback patch failed:', err.message)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Live recommendations from the AI pipeline. Confirm or dismiss to feed the learning loop.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />)}
        </div>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="rounded-xl border border-white/10 bg-black/30">
            <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-emerald-500/20">
              All ({items.length})
            </TabsTrigger>
            <TabsTrigger value="unread" className="rounded-lg data-[state=active]:bg-emerald-500/20">
              Unread ({unread.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3">
            {items.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No notifications"
                description="Run the agent to generate recommendations."
                actionLabel="Go to signals"
                actionHref="/signals"
              />
            ) : (
              items.map(n => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onAction={(label) => handleAction(label, n)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="unread" className="space-y-3">
            {unread.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="All caught up"
                description="No unread notifications."
                actionLabel="View all"
                actionHref="/notifications"
              />
            ) : (
              unread.map(n => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  onAction={(label) => handleAction(label, n)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
