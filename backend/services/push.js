import webpush from 'web-push'
import { getCollection } from '../config/db.js'

let initialized = false

export function initPush() {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || 'mailto:admin@stocksense.app'
  if (!pub || !priv || pub === 'zxcvbnm') {
    console.warn('[push] VAPID keys not configured - push disabled')
    return
  }
  webpush.setVapidDetails(email, pub, priv)
  initialized = true
  console.log('[push] Initialized with VAPID keys')
}

export function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || ''
}

export async function subscribe(userId, subscription) {
  const col = getCollection('push_subscriptions')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId || !subscription?.endpoint) throw new Error('userId and subscription.endpoint required')
  const doc = { userId, endpoint: subscription.endpoint, keys: subscription.keys, created_at: new Date() }
  await col.updateOne({ userId, endpoint: subscription.endpoint }, { $set: doc }, { upsert: true })
  return doc
}

export async function unsubscribe(userId, endpoint) {
  const col = getCollection('push_subscriptions')
  if (!col) throw new Error('MongoDB not connected')
  const result = await col.deleteOne({ userId, endpoint })
  return { deletedCount: result.deletedCount }
}

export async function sendToUser(userId, { title, body, url, entityId, tag, type }) {
  if (!initialized) return { sent: 0, failed: 0, skipped: false }

  const prefCol = getCollection('agent_preferences')
  if (prefCol) {
    const prefs = await prefCol.findOne({ userId })
    if (prefs?.push_enabled === false) return { sent: 0, failed: 0, skipped: true }
    const typeMap = { recommendation: 'notify_recommendations', execution: 'notify_executions', rebalancing: 'notify_rebalancing', scan_complete: 'notify_scans' }
    const prefKey = typeMap[type]
    if (prefKey && prefs?.[prefKey] === false) return { sent: 0, failed: 0, skipped: true }
  }

  const col = getCollection('push_subscriptions')
  if (!col) return { sent: 0, failed: 0 }
  const subs = await col.find({ userId }).toArray()
  if (!subs.length) return { sent: 0, failed: 0 }

  const payload = JSON.stringify({ title, body, url: url || '/actions', entityId: entityId || null, tag: tag || null })
  let sent = 0, failed = 0
  const toRemove = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload)
      sent++
    } catch (err) {
      failed++
      if (err.statusCode === 410 || err.statusCode === 404) toRemove.push(sub.endpoint)
    }
  }

  if (toRemove.length) await col.deleteMany({ userId, endpoint: { $in: toRemove } })
  return { sent, failed }
}
