"use client"

import { useCallback, useRef, useState } from "react"
import { Check, Loader2, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { searchStocks } from "@/lib/api"
import { getSectorSuggestions } from "@/lib/sectorStocks"

export function WatchlistStockSelector({
  sectors = [],
  stocks = [],
  maxStocks = 20,
  onAdd,
  onRemove,
  showSuggestions = true,
  listVariant = "rows",
  disabled = false,
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [busy, setBusy] = useState(null)
  const debounceRef = useRef(null)
  const abortRef = useRef(null)

  const suggestions = getSectorSuggestions(sectors)
  const isSelected = (ticker) => stocks.some((s) => s.ticker === ticker)
  const atLimit = stocks.length >= maxStocks

  const handleSearch = useCallback((value) => {
    setQuery(value)
    setNoResults(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
    if (value.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const data = await searchStocks(value)
        if (!controller.signal.aborted) {
          setResults(data || [])
          setNoResults(!data?.length)
          setSearching(false)
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([])
          setSearching(false)
        }
      }
    }, 300)
  }, [])

  const handleAdd = async (ticker, name) => {
    if (disabled || isSelected(ticker) || atLimit) return
    setBusy(ticker)
    try {
      await onAdd?.(ticker, name)
    } finally {
      setBusy(null)
    }
  }

  const handleRemove = async (ticker) => {
    if (disabled) return
    setBusy(ticker)
    try {
      await onRemove?.(ticker)
    } finally {
      setBusy(null)
    }
  }

  const toggle = (ticker, name) => {
    if (isSelected(ticker)) handleRemove(ticker)
    else handleAdd(ticker, name)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search company or ticker..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-white/15 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2">
          {results.map((r) => (
            <button
              key={`${r.symbol}-${r.exchange}`}
              type="button"
              disabled={disabled || (!isSelected(r.symbol) && atLimit)}
              onClick={() => toggle(r.symbol, r.name)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-40",
                isSelected(r.symbol) ? "bg-emerald-500/20 text-emerald-100" : "hover:bg-white/5"
              )}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{r.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">({r.symbol})</span>
              </div>
              {busy === r.symbol ? <Loader2 className="size-4 animate-spin" /> : isSelected(r.symbol) && <Check className="size-4 shrink-0 text-emerald-400" />}
            </button>
          ))}
        </div>
      )}

      {noResults && query.length >= 2 && !searching && (
        <p className="text-center text-xs text-muted-foreground">No matching stocks found.</p>
      )}

      {stocks.length > 0 && (
        <div className="space-y-2">
          {listVariant === "rows" ? (
            <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-black/20">
              {stocks.map((s) => (
                <div key={s.ticker} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold">{s.ticker}</span>
                    <span className="ml-3 text-muted-foreground truncate">{s.name}</span>
                  </div>
                  <button
                    type="button"
                    disabled={disabled || busy === s.ticker}
                    onClick={() => handleRemove(s.ticker)}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground disabled:opacity-50"
                    aria-label={`Remove ${s.ticker}`}
                  >
                    {busy === s.ticker ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {stocks.map((s) => (
                <span
                  key={s.ticker}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200"
                >
                  {s.ticker}
                  <button
                    type="button"
                    disabled={disabled || busy === s.ticker}
                    onClick={() => handleRemove(s.ticker)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-emerald-500/20 disabled:opacity-50"
                    aria-label={`Remove ${s.ticker}`}
                  >
                    {busy === s.ticker ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Popular {(sectors?.length ? sectors : ["Technology"]).join(", ")} stocks
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((stock) => {
              const selected = isSelected(stock.ticker)
              return (
                <Button
                  key={stock.ticker}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || (!selected && atLimit)}
                  className={cn(
                    "rounded-full px-3 text-xs transition-all",
                    selected
                      ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                      : "border-white/15 bg-black/30 hover:border-emerald-500/40 hover:bg-emerald-500/10"
                  )}
                  onClick={() => toggle(stock.ticker, stock.name)}
                >
                  {stock.name} <span className="text-muted-foreground">({stock.ticker})</span>
                  {selected && <Check className="ml-1.5 size-3" />}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {atLimit && (
        <p className="text-xs text-amber-200/90">Maximum {maxStocks} stocks reached. Remove one to add another.</p>
      )}
    </div>
  )
}
