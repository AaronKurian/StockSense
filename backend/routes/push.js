import { getPublicKey, subscribe as pushSubscribe, unsubscribe as pushUnsubscribe } from '../services/push.js'
import { createNotification } from '../services/notifications.js'

export function registerPushRoutes(app) {
  app.get('/api/push/public-key', (_req, res) => {
    res.json({ publicKey: getPublicKey() })
  })

  app.post('/api/push/subscribe', async (req, res) => {
    try {
      const { subscription } = req.body
      if (!subscription) return res.status(400).json({ error: 'subscription required' })
      await pushSubscribe(req.userId, subscription)
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/push/unsubscribe', async (req, res) => {
    try {
      const { endpoint } = req.body
      if (!endpoint) return res.status(400).json({ error: 'endpoint required' })
      res.json(await pushUnsubscribe(req.userId, endpoint))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/push/test', async (req, res) => {
    try {
      const result = await createNotification({
        userId: req.userId,
        type: 'test',
        title: 'Push Test',
        message: 'This is a test notification from StockSense.',
      })
      const push = result.push || { sent: 0, failed: 0, reason: 'push_not_initialized' }
      const delivered = (push.sent || 0) > 0
      res.json({
        notification: result._id,
        delivered,
        push,
        hint: delivered ? undefined : (push.reason === 'no_subscriptions'
          ? 'No push subscription found for this device. Enable notifications first.'
          : push.skipped ? 'Push skipped by your notification preferences.'
          : 'Push not configured on the server (missing VAPID keys).'),
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
