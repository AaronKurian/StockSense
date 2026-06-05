import cron from 'node-cron'
import { getCollection } from '../config/db.js'
import { runAgentForUser, expireStaleRecommendations } from './agent.js'
import { createNotification } from './notifications.js'

let tasks = []
let lastRunByUser = new Map()

const FREQUENCY_INTERVALS_MS = {
  realtime: 5 * 60 * 1000,
  hourly:   60 * 60 * 1000,
  daily:    24 * 60 * 60 * 1000,
  weekly:   7 * 24 * 60 * 60 * 1000,
}

function shouldRun(userId, frequency) {
  const last = lastRunByUser.get(userId)
  if (!last) return true
  const interval = FREQUENCY_INTERVALS_MS[frequency] || FREQUENCY_INTERVALS_MS.daily
  return (Date.now() - last) >= interval
}

async function runScheduledScan() {
  const col = getCollection('agent_preferences')
  if (!col) return
  const prefs = await col.find({ enabled: true }).toArray()
  if (!prefs.length) return

  const expired = await expireStaleRecommendations()
  if (expired > 0) console.log(`[scheduler] Expired ${expired} stale recommendation(s)`)

  let scanned = 0
  for (const pref of prefs) {
    const freq = pref.signal_frequency || 'daily'
    if (!shouldRun(pref.userId, freq)) continue

    try {
      const results = await runAgentForUser(pref.userId)
      const saved = results.filter(r => r._id && !r.error)
      lastRunByUser.set(pref.userId, Date.now())
      scanned++
      if (saved.length) {
        await createNotification({
          userId: pref.userId, type: 'scan_complete',
          title: `Scan complete — ${saved.length} signal(s)`,
          message: saved.map(r => `${r.signal} ${r.ticker}`).join(', '),
        })
      }
      console.log(`[scheduler] ${pref.userId}: ${saved.length} new, freq=${freq}`)
    } catch (err) {
      console.error(`[scheduler] ${pref.userId} failed:`, err.message)
    }
  }
  if (scanned) console.log(`[scheduler] Scanned ${scanned} user(s)`)
}

export function startScheduler() {
  if (tasks.length) return
  tasks.push(cron.schedule('*/5 * * * *', runScheduledScan))
  console.log('[scheduler] Started — checking every 5 minutes, respects signal_frequency per user')
}

export function stopScheduler() {
  tasks.forEach(t => t.stop())
  tasks = []
}

export function getNextScanTime(frequency) {
  const interval = FREQUENCY_INTERVALS_MS[frequency] || FREQUENCY_INTERVALS_MS.daily
  return new Date(Date.now() + interval)
}

export async function triggerManualScan(userId) {
  const results = await runAgentForUser(userId)
  const saved = results.filter(r => r._id && !r.error)
  lastRunByUser.set(userId, Date.now())
  if (saved.length) {
    await createNotification({
      userId, type: 'scan_complete',
      title: `Manual scan — ${saved.length} signal(s)`,
      message: saved.map(r => `${r.signal} ${r.ticker}`).join(', '),
    })
  }
  return { signals_generated: saved.length, results }
}
