"use client"

import { motion } from "framer-motion"
import { formatTimeAgo } from "@/lib/format"

export function Timeline({ items }) {
  return (
    <div className="relative pl-4">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-emerald-500/50 via-blue-500/30 to-transparent" />
      <ul className="space-y-6">
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="relative"
          >
            <span className="absolute -left-[3px] top-1.5 size-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            <p className="text-[11px] text-muted-foreground">{formatTimeAgo(item.time)}</p>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
