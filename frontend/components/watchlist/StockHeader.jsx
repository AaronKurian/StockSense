"use client"

import { motion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatNumber, formatPct } from "@/lib/format"
import { cn } from "@/lib/utils"

export function StockHeader({ stock, signal }) {
  const up = stock.changePct >= 0
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{stock.ticker}</h1>
          <Badge variant="outline" className="rounded-lg border-white/15 text-xs">
            {stock.exchange}
          </Badge>
          {signal ? (
            <Badge className="rounded-lg bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30">
              AI {signal.type}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-muted-foreground">{stock.name}</p>
        <div className="mt-4 flex flex-wrap items-baseline gap-3">
          <motion.span className="font-mono text-4xl font-semibold tracking-tight" layout>
            {formatNumber(stock.price, 2)}
          </motion.span>
          <span
            className={cn(
              "inline-flex items-center gap-1 font-mono text-sm",
              up ? "text-emerald-300" : "text-rose-300",
            )}
          >
            {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
            {formatPct(stock.changePct)} <span className="text-muted-foreground">today</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs md:max-w-md md:grid-cols-4">
        {[
          ["Sector", stock.sector],
          ["Volume", stock.volume],
          ["P/E", String(stock.pe)],
          ["Mkt cap", `${stock.mcapCr.toLocaleString("en-IN")} Cr`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
            <p className="text-muted-foreground">{k}</p>
            <p className="mt-1 font-medium text-foreground">{v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
