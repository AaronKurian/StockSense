"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Settings, Shield, Brain, Radio, Save, Bell } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/useAuth"
import { usePushNotifications } from "@/hooks/usePushNotifications"
import { fetchPreferences, createPreferences, updatePreferences } from "@/lib/api"

export function SettingsPage() {
  const { userId, user } = useAuth()
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe } = usePushNotifications()
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    fetchPreferences(userId)
      .then(d => { if (d && d.userId) setPrefs(d); else doCreateDefaults() })
      .catch(() => doCreateDefaults())
      .finally(() => setLoading(false))
  }, [userId])

  const doCreateDefaults = () => {
    createPreferences(userId).then(setPrefs).catch(() => {})
  }

  const save = async () => {
    if (!prefs) return
    setSaving(true)
    try {
      const data = await updatePreferences(userId, prefs)
      setPrefs(data)
      toast.success('Preferences saved')
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl bg-white/5" />)}</div>

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">Configure your agent preferences and risk controls.</p>
        </div>
        <Button onClick={save} disabled={saving} className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500">
          <Save className="size-4 mr-1.5" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Settings className="size-4 text-blue-300" /> Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Name</label>
            <Input readOnly value={user?.name || ''} className="mt-1 rounded-xl border-white/10 bg-black/30" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input readOnly value={user?.email || ''} className="mt-1 rounded-xl border-white/10 bg-black/30" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Brain className="size-4 text-emerald-300" /> Agent Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {['default', 'agentic'].map(m => (
              <button key={m} onClick={() => setPrefs(p => ({ ...p, mode: m }))}
                className={`flex-1 rounded-xl border p-4 text-left transition-all ${prefs?.mode === m ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-black/30 hover:border-white/20'}`}>
                <p className="text-sm font-semibold capitalize">{m}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {m === 'default' ? 'Recommendations require your approval before execution.' : 'Agent automatically executes trades above confidence threshold.'}
                </p>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Agent enabled</label>
            <button onClick={() => setPrefs(p => ({ ...p, enabled: !p.enabled }))}
              className={`relative h-6 w-11 rounded-full transition-colors ${prefs?.enabled ? 'bg-emerald-500' : 'bg-white/20'}`}>
              <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform ${prefs?.enabled ? 'translate-x-5' : ''}`} />
            </button>
            <Badge variant="outline" className={prefs?.enabled ? 'border-emerald-500/30 text-emerald-200' : 'border-white/10'}>{prefs?.enabled ? 'Active' : 'Paused'}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="size-4 text-blue-300" /> Risk Controls</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Risk Tolerance</label>
            <div className="flex gap-2 mt-2">
              {['conservative', 'moderate', 'aggressive'].map(r => (
                <button key={r} onClick={() => setPrefs(p => ({ ...p, risk_tolerance: r }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition-all ${prefs?.risk_tolerance === r ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 hover:border-white/20'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Investment Horizon</label>
            <div className="flex gap-2 mt-2">
              {['short', 'medium', 'long'].map(h => (
                <button key={h} onClick={() => setPrefs(p => ({ ...p, investment_horizon: h }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition-all ${prefs?.investment_horizon === h ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 hover:border-white/20'}`}>
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Minimum Confidence</label>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min="50" max="95" value={Math.round((prefs?.min_confidence || 0.7) * 100)}
                onChange={e => setPrefs(p => ({ ...p, min_confidence: Number(e.target.value) / 100 }))}
                className="flex-1" />
              <span className="font-mono text-sm w-10 text-right">{Math.round((prefs?.min_confidence || 0.7) * 100)}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Max Position Size</label>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min="5" max="50" value={prefs?.max_position_size_pct || 25}
                onChange={e => setPrefs(p => ({ ...p, max_position_size_pct: Number(e.target.value) }))}
                className="flex-1" />
              <span className="font-mono text-sm w-10 text-right">{prefs?.max_position_size_pct || 25}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Stop Loss</label>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min="3" max="30" value={prefs?.stop_loss_pct || 10}
                onChange={e => setPrefs(p => ({ ...p, stop_loss_pct: Number(e.target.value) }))}
                className="flex-1" />
              <span className="font-mono text-sm w-10 text-right">{prefs?.stop_loss_pct || 10}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Take Profit</label>
            <div className="flex items-center gap-3 mt-2">
              <input type="range" min="5" max="50" value={prefs?.take_profit_pct || 20}
                onChange={e => setPrefs(p => ({ ...p, take_profit_pct: Number(e.target.value) }))}
                className="flex-1" />
              <span className="font-mono text-sm w-10 text-right">{prefs?.take_profit_pct || 20}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Radio className="size-4 text-amber-200" /> Signal Configuration</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Signal Frequency</label>
            <div className="flex gap-2 mt-2">
              {['realtime', 'hourly', 'daily', 'weekly'].map(f => (
                <button key={f} onClick={() => setPrefs(p => ({ ...p, signal_frequency: f }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition-all ${prefs?.signal_frequency === f ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 hover:border-white/20'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Preferred Sectors</label>
            <Input value={prefs?.preferred_sectors?.join(', ') || ''}
              onChange={e => setPrefs(p => ({ ...p, preferred_sectors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
              placeholder="Technology, Healthcare, Energy"
              className="mt-2 rounded-xl border-white/10 bg-black/30 text-sm" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4 text-emerald-300" /> Push Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Browser Push Notifications</p>
              <p className="text-xs text-muted-foreground">{!isSupported ? 'Not supported in this browser' : permission === 'denied' ? 'Blocked - enable in browser settings' : isSubscribed ? 'Active - receiving notifications' : 'Disabled'}</p>
            </div>
            <Button size="sm" variant={isSubscribed ? "outline" : "default"} className="rounded-xl" onClick={isSubscribed ? unsubscribe : subscribe} disabled={!isSupported || permission === 'denied'}>
              {isSubscribed ? 'Disable' : 'Enable'}
            </Button>
          </div>
          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Notification Categories</p>
            {[
              { key: 'notify_recommendations', label: 'Recommendations', desc: 'New BUY/EXIT signals' },
              { key: 'notify_executions', label: 'Trade Executions', desc: 'When trades are executed' },
              { key: 'notify_rebalancing', label: 'Rebalancing Alerts', desc: 'Portfolio imbalance warnings' },
              { key: 'notify_scans', label: 'Scan Complete', desc: 'Agent scan finished (low priority)' },
            ].map(cat => (
              <div key={cat.key} className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground">{cat.desc}</p>
                </div>
                <button onClick={() => setPrefs(p => ({ ...p, [cat.key]: !p[cat.key] }))}
                  className={`relative h-5 w-9 rounded-full transition-colors ${prefs?.[cat.key] !== false ? 'bg-emerald-500' : 'bg-white/20'}`}>
                  <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform ${prefs?.[cat.key] !== false ? 'translate-x-4' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
