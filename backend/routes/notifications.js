import { getCollection } from '../config/db.js'
import { getNotifications, markRead, markAllRead, getUnreadCount } from '../services/notifications.js'

async function findOwnedNotification(req) {
  const col = getCollection('notifications')
  const { ObjectId } = await import('mongodb')
  let q
  try { q = { _id: new ObjectId(req.params.id) } } catch { q = { _id: req.params.id } }
  const notification = await col?.findOne(q)
  return notification && notification.userId === req.userId ? { col, q, notification } : null
}

export function registerNotificationRoutes(app) {
  app.get('/api/notifications', async (req, res) => {
    try {
      const { userId, unreadOnly, limit } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getNotifications(userId, { unreadOnly: unreadOnly === 'true', limit: limit ? Number(limit) : 50 }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/notifications/count', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json({ unread: await getUnreadCount(userId) })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/notifications/:id/read', async (req, res) => {
    try {
      const owned = await findOwnedNotification(req)
      if (!owned) return res.status(404).json({ error: 'Notification not found' })
      await markRead(req.params.id)
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/notifications/read-all', async (req, res) => {
    try {
      const { userId } = req.body
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      await markAllRead(userId)
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/notifications/:id', async (req, res) => {
    try {
      const owned = await findOwnedNotification(req)
      if (!owned) return res.status(404).json({ error: 'Notification not found' })
      await owned.col.deleteOne(owned.q)
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/notifications', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      const col = getCollection('notifications')
      if (!col) return res.status(500).json({ error: 'DB not connected' })
      const result = await col.deleteMany({ userId })
      res.json({ ok: true, deleted: result.deletedCount })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
