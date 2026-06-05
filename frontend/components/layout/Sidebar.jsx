"use client"
import { useAuth } from "@/hooks/useAuth"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Brain, Database, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { mainNav } from "@/lib/nav"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { fetchSignals } from "@/lib/api"


const COLLECTIONS = [
  { name: 'watchlist_items', purpose: 'Tickers being tracked' },
  { name: 'portfolio_positions', purpose: 'Holdings + avg price' },
  { name: 'recommendation_log', purpose: 'Signals + user feedback' },
  { name: 'latest_prices', purpose: 'Live WS price cache' },
  { name: 'users', purpose: 'Profile + preferences' },
]

export function Sidebar({ variant = "desktop" }) {
  const { userId, user, logout } = useAuth()
  const pathname = usePathname()
  const isDrawer = variant === "drawer"
  const [signalCount, setSignalCount] = useState(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchSignals(userId, { limit: 100 })
      .then(data => { if (!ctrl.signal.aborted && Array.isArray(data)) setSignalCount(data.length) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

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
            return (
              <Link key={item.href} href={item.href}>
                <motion.span layout className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors", active ? "bg-white/10 text-foreground shadow-sm ring-1 ring-emerald-500/20" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")} whileTap={{ scale: 0.98 }}>
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                  {item.href === "/signals" && signalCount != null && (
                    <Badge className="ml-auto border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-200">{signalCount}</Badge>
                  )}
                </motion.span>
              </Link>
            )
          })}
        </nav>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Database className="size-3.5 text-blue-300" />
            MongoDB Atlas
          </div>
          <div className="space-y-1.5">
            {COLLECTIONS.map(c => (
              <div key={c.name} className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                <span className="font-mono text-[10px] text-emerald-200">{c.name}</span>
                <p className="text-[10px] text-muted-foreground">{c.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/40 to-emerald-500/30 text-xs font-semibold">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.risk_tolerance || 'moderate'} · {user?.investment_horizon || 'medium'}</p>
          </div>
        </div>
        <Button asChild variant="ghost" className="mt-3 w-full justify-start gap-2 rounded-xl text-muted-foreground hover:text-foreground" onClick={logout}>
          <span><LogOut className="size-4" />Log out</span>
        </Button>
      </div>
    </aside>
  )
}
