import { getCollection } from '../config/db.js'
import { sendToUser } from './push.js'

export async function createNotification({ userId, type, title, message, ticker = null, recId = null }) {
  const col = getCollection('notifications')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId || !title) throw new Error('userId and title required')

  const doc = { userId, type: type || 'info', title, message: message || '', ticker: ticker || null, recId: recId || null, read: false, created_at: new Date() }
  const res = await col.insertOne(doc)

  const pushType = { recommendation: 'recommendation', trade_executed: 'execution', auto_executed: 'execution', scan_complete: 'scan_complete', rebalancing: 'rebalancing' }[type] || null
  if (pushType) {
    sendToUser(userId, { title, body: message || '', url: '/actions', entityId: recId || null, tag: `${type}-${ticker || 'general'}`, type: pushType }).catch(() => {})
  }

  return { ...doc, _id: res.insertedId }
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
