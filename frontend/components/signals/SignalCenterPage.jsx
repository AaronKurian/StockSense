"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Radio, Search, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { SignalCard } from "@/components/signals/SignalCard"
import { demoSignals } from "@/data/demo-data"
import { EmptyState } from "@/components/common/EmptyState"

const sectors = ["All", "IT Services", "Pharma", "Banking", "Energy", "Auto"]

export function SignalCenterPage() {
  const [q, setQ] = useState("")
  const [sector, setSector] = useState("All")
  const [urgency, setUrgency] = useState("all")
  const [minConf, setMinConf] = useState([60])

  const filtered = useMemo(() => {
    return demoSignals.filter((s) => {
      if (q && !`${s.ticker} ${s.name}`.toLowerCase().includes(q.toLowerCase())) return false
      if (sector !== "All" && s.sector !== sector) return false
      if (urgency !== "all" && s.urgency !== urgency) return false
      if (s.confidence < minConf[0]) return false
      return true
    })
  }, [q, sector, urgency, minConf])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Signal center</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every recommendation includes confidence, rationale, supporting factors, risks, and urgency — tuned for
          explainability scoring in demos.
        </p>
      </div>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="space-y-4 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ticker or company…"
                className="h-11 rounded-xl border-white/10 bg-black/30 pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {sectors.map((s) => (
                <Badge
                  key={s}
                  variant={sector === s ? "default" : "outline"}
                  className="cursor-pointer rounded-full border-white/15 px-3 py-1 text-xs"
                  onClick={() => setSector(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <SlidersHorizontal className="size-3.5" />
                Minimum confidence: <span className="font-mono text-foreground">{minConf[0]}%</span>
              </div>
              <Slider value={minConf} min={40} max={95} step={1} onValueChange={setMinConf} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Urgency</span>
              {["all", "high", "medium", "low"].map((u) => (
                <Badge
                  key={u}
                  variant={urgency === u ? "default" : "outline"}
                  className="cursor-pointer rounded-full border-white/15 capitalize"
                  onClick={() => setUrgency(u)}
                >
                  {u}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="cards" className="space-y-4">
        <TabsList className="rounded-xl border border-white/10 bg-black/30">
          <TabsTrigger value="cards" className="rounded-lg data-[state=active]:bg-emerald-500/20">
            Cards
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-lg data-[state=active]:bg-emerald-500/20">
            Timeline
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cards" className="space-y-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No signals match filters"
              description="Relax confidence or urgency filters to see the full demo set."
              actionLabel="Reset search"
              actionHref="/signals"
            />
          ) : (
            filtered.map((s) => <SignalCard key={s.id} signal={s} />)
          )}
        </TabsContent>
        <TabsContent value="timeline">
          <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
            <CardContent className="space-y-4 p-5">
              {filtered.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</p>
                    <p className="text-sm font-semibold">
                      {s.type} {s.ticker}{" "}
                      <span className="font-normal text-muted-foreground">· {s.confidence}%</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{s.headline}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {s.urgency}
                  </Badge>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
