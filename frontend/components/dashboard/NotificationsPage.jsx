"use client"

import { useMemo } from "react"
import { demoNotifications } from "@/data/demo-data"
import { NotificationCard } from "@/components/dashboard/NotificationCard"
import { EmptyState } from "@/components/common/EmptyState"
import { Bell } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function NotificationsPage() {
  const items = demoNotifications

  const unread = useMemo(() => items.filter((n) => !n.read), [items])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          BUY / EXIT / rebalance / news / triggers — each card supports confirm, dismiss, and drill-in navigation.
        </p>
      </div>

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
              title="You are all caught up"
              description="No notifications in the demo inbox — flip filters or reset mock state."
              actionLabel="Go to signals"
              actionHref="/signals"
            />
          ) : (
            items.map((n) => <NotificationCard key={n.id} notification={n} />)
          )}
        </TabsContent>
        <TabsContent value="unread" className="space-y-3">
          {unread.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No unread items"
              description="You have cleared the high-priority stack."
              actionLabel="View signals"
              actionHref="/signals"
            />
          ) : (
            unread.map((n) => <NotificationCard key={n.id} notification={n} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
