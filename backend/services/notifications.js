import { getCollection } from '../config/db.js'
import { sendToUser } from './push.js'

export async function createNotification({ userId, type, title, message, ticker = null, recId = null }) {
  const col = getCollection('notifications')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId || !title) throw new Error('userId and title required')

  let subtype = type
  let url = '/actions'
  if (type === 'auto_executed' || type === 'trade_executed') {
    const msgLower = (message || '').toLowerCase()
    if (msgLower.includes('stop-loss') || msgLower.includes('stop loss')) { subtype = 'stop_loss'; url = '/actions' }
    else if (msgLower.includes('take-profit') || msgLower.includes('take profit')) { subtype = 'take_profit'; url = '/actions' }
    else if (msgLower.includes('trailing stop') || msgLower.includes('trailing-stop')) { subtype = 'trailing_stop'; url = '/actions' }
    else if (msgLower.includes('sell') || msgLower.includes('exit')) { subtype = 'sell'; url = '/actions' }
    else { subtype = 'buy'; url = '/actions' }
  } else if (type === 'rebalancing') { subtype = 'rebalance'; url = '/actions' }
  else if (type === 'recommendation') { url = ticker ? `/signals?ticker=${ticker}` : '/signals' }
  else if (type === 'scan_complete') { url = '/dashboard' }

  const doc = { userId, type: type || 'info', subtype, title, message: message || '', ticker: ticker || null, recId: recId || null, url, read: false, created_at: new Date() }
  const res = await col.insertOne(doc)

  let pushResult = null
  const pushType = { recommendation: 'recommendation', trade_executed: 'execution', auto_executed: 'execution', scan_complete: 'scan_complete', rebalancing: 'rebalancing', test: 'test' }[type] || null
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
