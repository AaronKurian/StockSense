import {
  LayoutDashboard,
  Radio,
  Zap,
  History,
  MessageSquare,
  Bell,
  Settings,
  Sparkles,
} from "lucide-react"

export const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/history", label: "History", icon: History },
  { href: "/agent", label: "Agent", icon: MessageSquare },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
]

export const mobileNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/agent", label: "Agent", icon: Sparkles },
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/settings", label: "More", icon: Settings },
]
