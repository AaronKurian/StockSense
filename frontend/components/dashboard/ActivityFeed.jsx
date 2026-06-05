"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Activity, Bell, Radio } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSSEPrices } from "@/lib/api"
import { formatTimeAgo } from "@/lib/format"

const icon = {
  signal: Radio,
  price:  Activity,
  alert:  Bell,
}

/**
 * ActivityFeed — shows real-time SSE price updates as a live feed.
 * No demo data. Populated purely by the SSE price stream.
 */
export function ActivityFeed() {
  const [items, setItems] = useState([])

  useSSEPrices((data) => {
    setItems(prev => {
      const entry = {
        id:   `${data.ticker}-${Date.now()}`,
        type: 'price',
        text: `${data.ticker} → $${Number(data.price).toFixed(2)}`,
        time: data.updated_at ?? new Date().toISOString(),
      }
      return [entry, ...prev].slice(0, 30) // keep last 30 events
    })
  })

  if (!items.length) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-sm text-muted-foreground">
        Waiting for live price updates via SSE…
      </div>
    )
  }

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
              transition={{ delay: i * 0.02 }}
              className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <Icon className="size-4 text-emerald-300/90" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{item.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatTimeAgo(item.time)}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
