"use client"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, Menu, Search, Sparkles } from "lucide-react"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/Sidebar"
import { fetchUnreadCount } from "@/lib/api"
import { onNotificationsChanged } from "@/lib/events"

export function TopNavbar() {
  const { userId } = useAuth()
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const refresh = () => {
      fetchUnreadCount(userId)
        .then(d => { if (!cancelled) setUnread(d.unread || 0) })
        .catch(() => {})
    }
    refresh()

    const interval = setInterval(refresh, 30000)
    const unsub = onNotificationsChanged(refresh)
    return () => { cancelled = true; clearInterval(interval); unsub() }
  }, [userId])

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/70 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 md:h-16 md:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-white/10 bg-sidebar p-0">
            <Sidebar variant="drawer" />
          </SheetContent>
        </Sheet>

        <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
          {/* <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              readOnly
              aria-label="Search tickers, signals, history"
              placeholder="Search tickers, signals, history…"
              className="h-10 rounded-md border-white/10 bg-white/5 pl-10"
            />
          </div> */}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
          <Button asChild size="sm" className="hidden rounded-md bg-gradient-to-r from-emerald-500 to-blue-500 text-primary-foreground shadow-lg shadow-emerald-500/20 md:inline-flex">
            <Link href="/agent">
              <Sparkles className="mr-1.5 size-4" />
              Ask agent
            </Link>
          </Button>

          <Button asChild variant="ghost" size="icon" className="relative rounded-md" aria-label="Notifications">
            <Link href="/notifications">
              <Bell className="size-5" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-emerald-400 ring-2 ring-background" />}
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
