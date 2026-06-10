"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const VALID_SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Energy', 'Industrials', 'Utilities',
  'Consumer Defensive', 'Consumer Cyclical', 'Communication Services', 'Real Estate', 'Materials',
]

export function SectorChipSelector({ value = [], onChange, className, id }) {
  const selected = Array.isArray(value) ? value : []
  const toggle = (sector) => {
    onChange?.(selected.includes(sector) ? selected.filter(s => s !== sector) : [...selected, sector])
  }
  return (
    <div id={id} role="group" aria-label="Preferred sectors" className={cn("flex flex-wrap gap-2", className)}>
      {VALID_SECTORS.map(sector => {
        const isOn = selected.includes(sector)
        return (
          <button
            key={sector}
            type="button"
            aria-pressed={isOn}
            onClick={() => toggle(sector)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
              isOn ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                : "border-white/15 bg-black/30 text-muted-foreground hover:border-white/25 hover:text-foreground"
            )}
          >
            {isOn && <Check className="size-3 shrink-0 text-emerald-400" aria-hidden />}
            {sector}
          </button>
        )
      })}
    </div>
  )
}
