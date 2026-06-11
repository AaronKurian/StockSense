import {
  LayoutDashboard,
  Radio,
  History,
  MessageSquare,
  Bell,
  Settings,
  Sparkles,
} from "lucide-react"

export const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/history", label: "History", icon: History },
  { href: "/agent", label: "Agent", icon: MessageSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
]

export const mobileNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/agent", label: "Agent", icon: Sparkles },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "More", icon: Settings },
]
