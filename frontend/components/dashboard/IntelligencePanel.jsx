"use client"

import { useEffect, useState } from "react"
import { Cpu, Database, RefreshCw, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const COLLECTIONS = [
  { name: 'users', purpose: 'Profiles + preferences' },
  { name: 'watchlists', purpose: 'User-defined watch groups' },
  { name: 'watchlist_items', purpose: 'Tickers being tracked' },
  { name: 'portfolio_positions', purpose: 'Holdings + avg cost' },
  { name: 'latest_prices', purpose: 'Live WS price cache' },
  { name: 'recommendation_log', purpose: 'AI signals + feedback' },
]

export function IntelligencePanel() {
  const [wsStatus, setWsStatus] = useState(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`${BASE}/api/ws/status`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => { if (!ctrl.signal.aborted) setWsStatus(d) })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-emerald-300" />
            Intelligence flywheel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p>Signals write to <span className="font-mono text-emerald-200">recommendation_log</span>. Confirms/ignores tune the preference vector.</p>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <RefreshCw className="size-4 animate-spin text-blue-300 [animation-duration:3.5s]" />
            <span>{wsStatus ? `WebSocket tracking ${wsStatus.subscribed_count} ticker(s)` : 'Connecting…'}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-blue-300" />
            MongoDB Atlas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {COLLECTIONS.map(c => (
            <div key={c.name} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-emerald-200">{c.name}</span>
                <Badge variant="outline" className="border-white/10 text-[10px]">Atlas</Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{c.purpose}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Cpu className="size-4 text-amber-200" />
            Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          runAgentForUser → get_price_context + get_market_news → Gemini 2.5 Flash → saveRecommendation → SSE broadcast
        </CardContent>
      </Card>
    </div>
  )
}
