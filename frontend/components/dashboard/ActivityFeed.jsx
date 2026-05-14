"use client"

import { motion } from "framer-motion"
import { Activity, Bell, Bot, Database, Newspaper, Radio } from "lucide-react"
import { demoActivityFeed } from "@/data/demo-data"
import { ScrollArea } from "@/components/ui/scroll-area"

const icon = {
  signal: Radio,
  news: Newspaper,
  memory: Database,
  alert: Bell,
  agent: Bot,
  mcp: Database,
}

export function ActivityFeed({ items = demoActivityFeed }) {
  return (
    <ScrollArea className="h-[320px] rounded-2xl border border-white/10 bg-black/25 pr-3">
      <div className="space-y-3 p-3">
        {items.map((item, i) => {
          const Icon = icon[item.type] || Activity
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <Icon className="size-4 text-emerald-300/90" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{item.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.time}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
