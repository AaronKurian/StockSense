"use client"
import { useAuth } from "@/hooks/useAuth"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { mainNav } from "@/lib/nav"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { fetchSignals, fetchPreferences, fetchUnreadCount } from "@/lib/api"
import { onActionsChanged, onNotificationsChanged, onSignalsChanged } from "@/lib/events"

export function Sidebar({ variant = "desktop" }) {
  const { userId, user, logout } = useAuth()
  const pathname = usePathname()
  const isDrawer = variant === "drawer"
  const [signalCount, setSignalCount] = useState(null)
  const [pendingCount, setPendingCount] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mode, setMode] = useState("manual")
  const intervalRef = useRef(null)

  const loadCounts = useCallback(() => {
    if (!userId) return
    fetchSignals(userId, { limit: 999 })
      .then(data => {
        if (!Array.isArray(data)) return
        setSignalCount(data.length)
        if (mode === "manual") {
          const pending = data.filter(r =>
            r.status === "generated" && (r.signal === "BUY" || r.signal === "EXIT")
          ).length
          setPendingCount(pending)
        } else {
          setPendingCount(null)
        }
      })
      .catch(() => {})
  }, [userId, mode])

  const loadUnreadCount = useCallback(() => {
    if (!userId) return
    fetchUnreadCount(userId)
      .then(d => setUnreadCount(d.unread || 0))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId) return
    fetchPreferences(userId)
      .then(p => setMode(p?.mode === "agentic" ? "agentic" : "manual"))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    loadCounts()
    intervalRef.current = setInterval(loadCounts, 30000)
    const unsub1 = onActionsChanged(loadCounts)
    const unsub2 = onSignalsChanged(loadCounts)
    return () => { clearInterval(intervalRef.current); unsub1(); unsub2() }
  }, [loadCounts])

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 30000)
    const unsub = onNotificationsChanged(loadUnreadCount)
    return () => { clearInterval(interval); unsub() }
  }, [loadUnreadCount, pathname])

  return (
    <aside className={cn("flex w-64 shrink-0 flex-col border-white/10 bg-sidebar/95 backdrop-blur-xl", isDrawer ? "h-full border-r-0" : "sticky top-0 hidden h-dvh border-r md:flex")}>
      <div className="flex items-center gap-2 px-5 py-3">
        <Image src="/favicon.png" alt="" width={48} height={48} className="w-10 h-10" />
        <div>
          <p className="text-sm font-semibold tracking-tight">StockSense</p>
        </div>
      </div>
      <Separator className="bg-white/10" />
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1" aria-label="Main navigation">
          {mainNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            const badge =
              item.href === "/notifications" && unreadCount > 0 ? unreadCount :
              item.href === "/signals" && mode === "manual" && pendingCount != null && pendingCount > 0 ? pendingCount :
              item.href === "/signals" && signalCount != null && signalCount > 0 && mode === "agentic" ? signalCount :
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
        <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/40 to-emerald-500/30 text-xs font-semibold">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
          </div>
          <button onClick={logout} title="Log out" className="shrink-0 text-red-500/70 hover:text-red-600/70 cursor-pointer">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
