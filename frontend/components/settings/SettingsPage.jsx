"use client"

import Link from "next/link"
import { LogOut } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { demoOnboardingSummary, demoUser } from "@/data/demo-data"
import { RiskProfileCard } from "@/components/dashboard/RiskProfileCard"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          UI-only controls — wire to Express + Mongo later for persistence.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RiskProfileCard />
        <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <Label>Name</Label>
              <Input readOnly value={demoUser.name} className="mt-1 rounded-xl border-white/10 bg-black/30" />
            </div>
            <div>
              <Label>Email</Label>
              <Input readOnly value={demoUser.email} className="mt-1 rounded-xl border-white/10 bg-black/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Risk profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Max single-name exposure (%)</Label>
            <Slider defaultValue={[18]} max={40} step={1} className="mt-3" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Loss tolerance (demo)</Label>
            <p className="mt-2 text-sm text-muted-foreground">Selected during onboarding: {demoOnboardingSummary.lossTolerance}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Notification preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            ["Push alerts for BUY signals", true],
            ["Push alerts for EXIT signals", true],
            ["Email digest (daily)", false],
            ["Rebalance nudges", true],
          ].map(([label, on]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">Maps to Web Push categories later.</p>
              </div>
              <Switch defaultChecked={on} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Sector preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            className="min-h-[96px] rounded-xl border-white/10 bg-black/30"
            value={demoOnboardingSummary.sectors.join(", ")}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">AI behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Cooldown between duplicate signals (hours)</Label>
            <Slider defaultValue={[6]} min={1} max={24} step={1} className="mt-3" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Prefer fewer, higher-conviction signals</p>
              <p className="text-xs text-muted-foreground">Raises confidence threshold dynamically.</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator className="bg-white/10" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Allow MongoDB MCP tool calls</p>
              <p className="text-xs text-muted-foreground">Agent can query collections with guardrails.</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Sign out of this device (demo UI — clears no server state yet).
          </p>
          <Button asChild variant="outline" className="shrink-0 rounded-xl border-white/15">
            <Link href="/login" className="inline-flex items-center gap-2">
              <LogOut className="size-4" />
              Log out
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="rounded-xl">Save (demo)</Button>
      </div>
    </div>
  )
}
