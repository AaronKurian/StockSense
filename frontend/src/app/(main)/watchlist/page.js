"use client"

import Link from "next/link"
import { WatchlistTable } from "@/components/watchlist/WatchlistTable"
import { Card, CardContent } from "@/components/ui/card"

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Watchlist</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Monitor tracked tickers, review live context and open symbol detail pages for deeper recommendation history.
        </p>
      </div>

      <WatchlistTable />

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
          <p>
            Recommendations and watchlist context are informational. You remain responsible for evaluating suitability
            and deciding whether to take any portfolio action.
          </p>
          <Link href="/risk-disclosure" className="inline-flex text-emerald-300 transition-colors hover:text-emerald-200">
            Read full risk disclosure
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
