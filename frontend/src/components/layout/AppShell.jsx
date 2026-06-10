import { Sidebar } from "@/components/layout/Sidebar"
import { TopNavbar } from "@/components/layout/TopNavbar"
import { MobileBottomNav } from "@/components/layout/MobileBottomNav"

export function AppShell({ children }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <TopNavbar />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
