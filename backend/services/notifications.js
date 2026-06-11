import { getCollection } from '../config/db.js'
import { sendToUser } from './push.js'
import { getPreferences } from './preferences.js'

export function formatTradeTitle(action, ticker) {
  return `${action} ${ticker}`
}

export function formatTradeMessage({ quantity, price, mode }) {
  const priceStr = `$${Number(price).toFixed(2)}`
  const modeText = mode === 'automatic' || mode === 'agentic' ? 'executed automatically' : 'executed after approval'
  return `${quantity} shares @ ${priceStr} ${modeText}`
}

export function formatRecommendationMessage({ confidence, mode }) {
  const pct = confidence != null ? Math.round(confidence * 100) : null
  if (mode === 'agentic') return pct != null ? `${pct}% confidence` : 'Agentic mode'
  return pct != null ? `Awaiting approval (${pct}% confidence)` : 'Awaiting approval'
}

export function formatScanMessage({ count, autoExecuted = 0 }) {
  if (count === 0) {
    return autoExecuted > 0 ? `${autoExecuted} trade(s) executed` : 'No new recommendations'
  }
  const parts = [`${count} recommendation${count === 1 ? '' : 's'} generated`]
  if (autoExecuted > 0) parts.push(`${autoExecuted} auto-executed`)
  return parts.join(', ')
}

export function formatRebalanceMessage({ sector, weight, maxPct }) {
  return `${sector} at ${Math.round(weight)}% (target <${maxPct}%)`
}

export function formatBlockMessage(reason) {
  if (!reason) return 'Execution blocked'
  const r = String(reason).toLowerCase()
  if (r === 'price_unavailable' || r.includes('price unavailable')) return 'Price data unavailable'
  if (r === 'stale_price' || r.includes('stale')) return 'Price data stale'
  if (r.includes('insufficient cash')) return 'Insufficient cash'
  if (r.includes('max') && r.includes('position')) return reason
  return reason.length > 80 ? reason.slice(0, 77) + '…' : reason
}

function resolveNotificationUrl({ type, ticker, recId }) {
  if (type === 'trade_executed' || type === 'auto_executed') {
    return recId ? `/history?recId=${recId}` : '/history'
  }
  if (type === 'blocked' || type === 'rebalancing' || type === 'recommendation') {
    if (recId) return `/signals/${recId}`
    if (ticker) return `/signals?ticker=${ticker}`
    return '/signals'
  }
  if (type === 'scan_complete') return '/dashboard'
  return '/notifications'
}

export async function createScanCompleteNotification(userId, { title, message, autoExecuted = 0, count = 0 }) {
  const prefs = await getPreferences(userId)
  if (prefs?.notify_scans === false) return null
  const body = message || formatScanMessage({ count, autoExecuted })
  return createNotification({
    userId,
    type: 'scan_complete',
    title: title || 'Scan complete',
    message: body,
  })
}

export async function createNotification({ userId, type, title, message, ticker = null, recId = null }) {
  const col = getCollection('notifications')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId || !title) throw new Error('userId and title required')

  let subtype = type
  if (type === 'auto_executed' || type === 'trade_executed') {
    const msgLower = (message || '').toLowerCase()
    if (msgLower.includes('stop-loss') || msgLower.includes('stop loss')) subtype = 'stop_loss'
    else if (msgLower.includes('take-profit') || msgLower.includes('take profit')) subtype = 'take_profit'
    else if (msgLower.includes('trailing stop') || msgLower.includes('trailing-stop')) subtype = 'trailing_stop'
    else if (title.toUpperCase().startsWith('SELL') || msgLower.includes('sell') || msgLower.includes('exit')) subtype = 'sell'
    else subtype = 'buy'
  } else if (type === 'rebalancing') subtype = 'rebalance'
  else if (type === 'blocked') subtype = 'blocked'

  const url = resolveNotificationUrl({ type, ticker, recId })

  const doc = { userId, type: type || 'info', subtype, title, message: message || '', ticker: ticker || null, recId: recId || null, url, read: false, created_at: new Date() }
  const res = await col.insertOne(doc)

  let pushResult = null
  const pushType = { recommendation: 'recommendation', trade_executed: 'execution', auto_executed: 'execution', scan_complete: 'scan_complete', rebalancing: 'rebalancing', blocked: 'blocked', test: 'test' }[type] || null
  if (pushType) {
    pushResult = await sendToUser(userId, { title, body: message || '', url, entityId: recId || null, tag: `${subtype}-${ticker || 'general'}`, type: pushType, subtype }).catch(() => ({ sent: 0, failed: 0, error: true }))
  }

  return { ...doc, _id: res.insertedId, push: pushResult }
}

export async function getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  const col = getCollection('notifications')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const q = { userId }
  if (unreadOnly) q.read = false
  return col.find(q).sort({ created_at: -1 }).limit(Number(limit)).toArray()
}

export async function markRead(notificationId) {
  const col = getCollection('notifications')
  if (!col) throw new Error('MongoDB not connected')
  const { ObjectId } = await import('mongodb')
  let q
  try { q = { _id: new ObjectId(notificationId) } } catch { q = { _id: notificationId } }
  await col.updateOne(q, { $set: { read: true } })
}

export async function markAllRead(userId) {
  const col = getCollection('notifications')
  if (!col) throw new Error('MongoDB not connected')
  await col.updateMany({ userId, read: false }, { $set: { read: true } })
}

export async function getUnreadCount(userId) {
  const col = getCollection('notifications')
  if (!col) return 0
  return col.countDocuments({ userId, read: false })
}
