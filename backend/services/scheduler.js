import cron from 'node-cron'
import { getCollection } from '../config/db.js'
import { runAgentForUser, expireStaleRecommendations, getScanTickers } from './agent.js'
import { createScanCompleteNotification } from './notifications.js'
import { runNightlyJobs, saveEquitySnapshot } from './learning.js'
import { runAutonomousExecution, acquireScanLock, releaseScanLock } from './autonomy.js'
import { getPreferences } from './preferences.js'
import { info, warn, error as logError } from '../lib/logger.js'

let tasks = []
let lastRunByUser = new Map()

const FREQUENCY_INTERVALS_MS = {
  '5min':   5 * 60 * 1000,
  '15min':  15 * 60 * 1000,
  '30min':  30 * 60 * 1000,
  hourly:   60 * 60 * 1000,
  daily:    24 * 60 * 60 * 1000,
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
  if (expired > 0) info('scheduler', `Expired ${expired} stale recommendation(s)`)

  let scanned = 0
  for (const pref of prefs) {
    const freq = pref.signal_frequency || 'daily'
    if (!shouldRun(pref.userId, freq)) continue

    const tickers = await getScanTickers(pref.userId)
    if (!tickers.length) {
      const mode = pref.mode === 'manual' ? 'manual' : 'agentic'
      if (mode === 'agentic') {
        try {
          await runAutonomousExecution(pref.userId, pref)
        } catch (err) {
          logError('scheduler', 'Autonomous execution failed (no tickers)', { userId: pref.userId, error: err.message })
        }
      }
      lastRunByUser.set(pref.userId, Date.now())
      continue
    }

    const lock = await acquireScanLock(pref.userId)
    if (!lock.acquired) {
      info('scheduler', 'Skip user - scan already in progress', { userId: pref.userId, reason: lock.reason })
      continue
    }

    try {
      const scanStart = Date.now()
      const tickersScanned = tickers.length
      const results = await runAgentForUser(pref.userId)
      const saved = results.filter(r => r._id && !r.error && !r._silent)
      const errors = results.filter(r => r.error)
      const duration_ms = Date.now() - scanStart

      let autoExecuted = 0

      const mode = pref.mode === 'manual' ? 'manual' : 'agentic'
      if (mode === 'agentic') {
        try {
          const exec = await runAutonomousExecution(pref.userId, pref)
          autoExecuted = exec.executed
        } catch (err) {
          logError('scheduler', 'Autonomous execution failed', { userId: pref.userId, error: err.message })
        }
      }

      await saveEquitySnapshot(pref.userId).catch(() => {})

      lastRunByUser.set(pref.userId, Date.now())
      scanned++

      await createScanCompleteNotification(pref.userId, {
        title: 'Scan complete',
        count: saved.length,
        autoExecuted,
      })

      await getCollection('scan_history')?.updateOne(
        { userId: pref.userId, completed_at: { $gte: new Date(Date.now() - 60000) } },
        { $set: {
          userId: pref.userId, completed_at: new Date(), mode, auto_executed: autoExecuted,
          recommendations_generated: saved.length, tickers_scanned: tickersScanned,
          recommendations: saved.length, executed: autoExecuted, duration_ms, source: 'scheduler',
        }},
        { upsert: true }
      )

      info('scheduler', 'User scan complete', { userId: pref.userId, mode, signals: saved.length, autoExecuted, errors: errors.length, frequency: freq })
    } catch (err) {
      logError('scheduler', 'User scan failed', { userId: pref.userId, error: err.message })
    } finally {
      await releaseScanLock(pref.userId)
    }
  }
  if (scanned) info('scheduler', `Scheduled scan cycle done`, { usersScanned: scanned })
}

async function runHourlyEquitySnapshots() {
  const col = getCollection('agent_preferences')
  if (!col) return
  const prefs = await col.find({ enabled: true }).toArray()
  for (const pref of prefs) {
    await saveEquitySnapshot(pref.userId).catch(() => {})
  }
}

export function startScheduler() {
  if (tasks.length) return
  tasks.push(cron.schedule('*/5 * * * *', runScheduledScan))
  tasks.push(cron.schedule('0 * * * *', runHourlyEquitySnapshots))
  tasks.push(cron.schedule('0 0 * * *', runNightlyJobs))
  info('scheduler', 'Started - scans every 5min, hourly equity snapshots, nightly jobs at midnight')
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
  info('scheduler', 'Manual scan triggered', { userId })

  const lock = await acquireScanLock(userId)
  if (!lock.acquired) {
    if (lock.reason === 'not_found') throw new Error('User not found')
    if (lock.reason === 'locked') {
      const err = new Error('Scan already in progress')
      err.code = 'SCAN_LOCKED'
      throw err
    }
    throw new Error('Could not acquire scan lock')
  }

  try {
    await expireStaleRecommendations()
    const scanStart = Date.now()
    const tickersScanned = (await getScanTickers(userId)).length
    const results = await runAgentForUser(userId)
    const saved = results.filter(r => r._id && !r.error && !r._silent)
    const errors = results.filter(r => r.error)
    const duration_ms = Date.now() - scanStart
    lastRunByUser.set(userId, Date.now())

    const prefs = await getPreferences(userId)
    const mode = prefs?.mode === 'manual' ? 'manual' : 'agentic'
    let autoExecuted = 0

    if (mode === 'agentic') {
      try {
        const exec = await runAutonomousExecution(userId, prefs)
        autoExecuted = exec.executed
      } catch (err) {
        logError('scheduler', 'Autonomous execution failed', { userId, error: err.message })
      }
    }

    await saveEquitySnapshot(userId).catch(() => {})

    await createScanCompleteNotification(userId, {
      title: 'Scan complete',
      count: saved.length,
      autoExecuted,
    })

    await getCollection('scan_history')?.updateOne(
      { userId, completed_at: { $gte: new Date(Date.now() - 60000) } },
      { $set: {
        userId, completed_at: new Date(), mode, auto_executed: autoExecuted,
        recommendations_generated: saved.length, tickers_scanned: tickersScanned,
        recommendations: saved.length, executed: autoExecuted, duration_ms, source: 'manual',
      }},
      { upsert: true }
    )

    if (errors.length > 0) {
      warn('scheduler', `${errors.length} ticker(s) failed during scan`, { userId, errors: errors.slice(0, 3).map(e => `${e.ticker}: ${e.error}`) })
    }
    info('scheduler', 'Manual scan complete', { userId, mode, signals: saved.length, autoExecuted, errors: errors.length })
    return { signals_generated: saved.length, errors: errors.length, results, mode, auto_executed: autoExecuted }
  } finally {
    await releaseScanLock(userId)
  }
}
