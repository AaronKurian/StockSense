"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Activity, Bell, Radio, Zap } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/useAuth"
import { useSSEPrices, fetchActivity } from "@/lib/api"
import { formatTimeAgo } from "@/lib/format"

const iconMap = { recommendation: Radio, trade_executed: Zap, auto_executed: Zap, scan_complete: Activity, info: Bell }
const colorMap = { recommendation: 'text-emerald-300', trade_executed: 'text-blue-300', auto_executed: 'text-purple-300', scan_complete: 'text-amber-300' }

export function ActivityFeed() {
  const { userId } = useAuth()
  const [items, setItems] = useState([])
  const [priceEvents, setPriceEvents] = useState([])

  useEffect(() => {
    if (!userId) return
    fetchActivity(userId, 15).then(d => { if (Array.isArray(d)) setItems(d) }).catch(() => {})
  }, [userId])

  useSSEPrices((data) => {
    setPriceEvents(prev => [{ id: `p_${Date.now()}`, type: 'price', title: `${data.ticker} → $${Number(data.price).toFixed(2)}`, created_at: data.updated_at }, ...prev].slice(0, 5))
  })

  const all = [...priceEvents, ...items].slice(0, 20)

  if (!all.length) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No activity yet. Run a scan or wait for live price updates.
      </div>
    )
  }

  return (
    <ScrollArea className="h-[320px] rounded-2xl border border-white/10 bg-black/25 pr-3">
      <div className="space-y-2 p-3">
        {all.map((item, i) => {
          const Icon = iconMap[item.type] || Activity
          const color = colorMap[item.type] || 'text-muted-foreground'
          return (
            <motion.div key={item._id || item.id || i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
              className="flex gap-3 rounded-md border border-white/5 bg-white/[0.02] p-2.5">
              <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/5`}>
                <Icon className={`size-3.5 ${color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-snug">{item.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatTimeAgo(item.created_at)}</p>
              </div>
              {item.type && item.type !== 'price' && (
                <Badge variant="outline" className="self-start text-[9px] border-white/10 shrink-0">{item.type.replace('_', ' ')}</Badge>
              )}
            </motion.div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
