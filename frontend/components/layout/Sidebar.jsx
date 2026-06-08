"use client"
import { useAuth } from "@/hooks/useAuth"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Brain, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { mainNav } from "@/lib/nav"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { fetchSignals, fetchActionsPending } from "@/lib/api"
import { onActionsChanged, onSignalsChanged } from "@/lib/events"

export function Sidebar({ variant = "desktop" }) {
  const { userId, user, logout } = useAuth()
  const pathname = usePathname()
  const isDrawer = variant === "drawer"
  const [signalCount, setSignalCount] = useState(null)
  const [pendingCount, setPendingCount] = useState(null)
  const intervalRef = useRef(null)

  const loadCounts = useCallback(() => {
    if (!userId) return
    fetchSignals(userId, { limit: 999 })
      .then(data => { if (Array.isArray(data)) setSignalCount(data.length) })
      .catch(() => {})
    fetchActionsPending(userId)
      .then(data => { if (Array.isArray(data)) setPendingCount(data.length) })
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    loadCounts()
    intervalRef.current = setInterval(loadCounts, 30000)
    const unsub1 = onActionsChanged(loadCounts)
    const unsub2 = onSignalsChanged(loadCounts)
    return () => { clearInterval(intervalRef.current); unsub1(); unsub2() }
  }, [loadCounts])

  return (
    <aside className={cn("flex w-64 shrink-0 flex-col border-white/10 bg-sidebar/95 backdrop-blur-xl", isDrawer ? "h-full border-r-0" : "sticky top-0 hidden h-dvh border-r md:flex")}>
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30 ring-1 ring-white/10">
          <Brain className="size-5 text-emerald-300" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">StockSense</p>
          <p className="text-xs text-muted-foreground">Signal-first intelligence</p>
        </div>
      </div>
      <Separator className="bg-white/10" />
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1" aria-label="Main navigation">
          {mainNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            const badge =
              item.href === "/signals" && signalCount != null && signalCount > 0 ? signalCount :
              item.href === "/actions" && pendingCount != null && pendingCount > 0 ? pendingCount :
              null
            return (
              <Link key={item.href} href={item.href}>
                <motion.span layout className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors", active ? "bg-white/10 text-foreground shadow-sm ring-1 ring-emerald-500/20" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")} whileTap={{ scale: 0.98 }}>
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                  {badge != null && (
                    <Badge className="ml-auto border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-200">{badge}</Badge>
                  )}
                </motion.span>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/40 to-emerald-500/30 text-xs font-semibold">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.risk_tolerance || 'moderate'} · {user?.investment_horizon || 'medium'}</p>
          </div>
        </div>
        <Button asChild variant="ghost" className="mt-3 w-full justify-start gap-2 rounded-md text-muted-foreground hover:text-foreground" onClick={logout}>
          <span><LogOut className="size-4" />Log out</span>
        </Button>
      </div>
    </aside>
  )
}
