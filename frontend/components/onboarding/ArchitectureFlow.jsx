"use client"

import { motion } from "framer-motion"
import {
  Bell,
  Bot,
  Database,
  LayoutGrid,
  RefreshCw,
  Server,
  Sparkles,
  User,
} from "lucide-react"

const demoArchitectureFlow = [
  { id: "1", label: "User", description: "Preferences, feedback, capital policy", icon: "user" },
  { id: "2", label: "Next.js PWA", description: "Proactive dashboard + SSE client", icon: "layout" },
  { id: "3", label: "Express + ADK", description: "APIs, Agent, Gemini reasoning", icon: "server" },
  { id: "4", label: "Agent Builder", description: "Orchestration + tool routing", icon: "bot" },
  { id: "5", label: "Gemini", description: "Reasoning, rationales, signals", icon: "sparkles" },
  { id: "6", label: "MongoDB Atlas", description: "Portfolio, signals, memory", icon: "database" },
  { id: "7", label: "BUY / HOLD / EXIT", description: "Confidence-scored recommendations", icon: "signal" },
  { id: "8", label: "Web Push", description: "Realtime alerts to devices", icon: "bell" },
  { id: "9", label: "Feedback loop", description: "recommendation_log → preference updates", icon: "refresh" },
]

const icons = {
  user: User,
  layout: LayoutGrid,
  server: Server,
  bot: Bot,
  sparkles: Sparkles,
  database: Database,
  signal: Sparkles,
  bell: Bell,
  refresh: RefreshCw,
}

export function ArchitectureFlow() {
  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {demoArchitectureFlow.map((step, i) => {
        const Icon = icons[step.icon] || Server
        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.05 }}
            className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            {i < demoArchitectureFlow.length - 1 && (
              <span className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-gradient-to-r from-emerald-500/50 to-transparent lg:block" />
            )}
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/25 to-blue-500/20 ring-1 ring-white/10">
              <Icon className="size-5 text-emerald-200" />
            </div>
            <p className="text-sm font-semibold">{step.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
          </motion.div>
        )
      })}
    </div>
  )
}
