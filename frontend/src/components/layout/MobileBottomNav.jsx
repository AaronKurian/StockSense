"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { mobileNav } from "@/lib/nav"

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {mobileNav.map((item) => {
          const Icon = item.icon
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md py-2 text-[10px] font-medium transition-colors",
                active ? "text-emerald-300" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "drop-shadow-[0_0_8px_rgba(52,211,153,0.55)]")} />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
