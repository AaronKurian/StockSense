"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { toast } from "sonner"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatTimeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

const kindStyle = {
  BUY: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  EXIT: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  rebalance: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  news: "border-white/15 bg-white/5 text-slate-100",
  trigger: "border-amber-500/30 bg-amber-500/10 text-amber-100",
}

export function NotificationCard({ notification, onAction }) {
  const on = (label) => {
    toast.message(label, { description: notification.title })
    onAction?.(label)
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <Badge variant="outline" className={cn("rounded-lg text-[10px] uppercase", kindStyle[notification.kind])}>
              {notification.kind}
            </Badge>
            <CardTitle className="text-base leading-snug">{notification.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{notification.body}</p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatTimeAgo(notification.time)}
          </span>
        </CardHeader>
        <CardContent className="pb-3">
          {notification.ticker ? (
            <Link
              href={`/watchlist/${notification.ticker}`}
              className="text-xs font-medium text-emerald-300 hover:underline"
            >
              Open {notification.ticker}
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">Portfolio-level alert</p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 border-t border-white/10 bg-black/20 px-4 py-3">
          {notification.actions.includes("confirm") && (
            <Button size="sm" className="rounded-xl" onClick={() => on("Confirmed")}>
              Confirm
            </Button>
          )}
          <Button size="sm" variant="outline" className="rounded-xl border-white/15" onClick={() => on("Dismissed")}>
            Dismiss
          </Button>
          <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => on("Details")}>
            View details
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
