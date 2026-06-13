import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getCollection } from '../config/db.js'
import { requireAuth } from '../middleware/auth.js'
import { createDefaultPreferences } from '../services/preferences.js'
import { info, error as logError } from '../lib/logger.js'

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-secret'
}

export function registerAuthRoutes(app) {
  app.post('/auth/signup', async (req, res) => {
    try {
      const { email, password, name } = req.body
      if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
      const col = getCollection('users')
      if (!col) return res.status(500).json({ error: 'DB not connected' })
      const normalizedEmail = email.toLowerCase().trim()
      const existing = await col.findOne({ email: normalizedEmail })
      if (existing) return res.status(409).json({ error: 'Email already registered' })

      const hash = await bcrypt.hash(password, 10)
      const userId = `user_${Date.now()}`
      const doc = {
        _id: userId,
        email: normalizedEmail,
        password: hash,
        name: name || email.split('@')[0],
        risk_tolerance: 'moderate',
        investment_horizon: 'medium',
        preferred_sectors: [],
        experience_level: 'intermediate',
        virtual_cash: 100000,
        starting_capital: 100000,
        created_at: new Date(),
        updated_at: new Date(),
      }
      await col.insertOne(doc)
      await createDefaultPreferences(userId)
      const token = jwt.sign({ sub: userId, email: doc.email }, getJwtSecret(), { expiresIn: '7d' })
      const { password: _, ...user } = doc
      info('auth', 'User signed up', { userId, email: doc.email })
      res.json({ token, user })
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'Email already registered' })
      logError('auth', 'Signup failed', { error: err.message })
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/auth/signin', async (req, res) => {
    try {
      const { email, password } = req.body
      if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
      const col = getCollection('users')
      if (!col) return res.status(500).json({ error: 'DB not connected' })
      const user = await col.findOne({ email: email.toLowerCase().trim() })
      if (!user) return res.status(401).json({ error: 'Invalid credentials' })
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

      const token = jwt.sign({ sub: user._id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      const { password: _, ...safe } = user
      info('auth', 'User signed in', { userId: user._id, email: user.email })
      res.json({ token, user: safe })
    } catch (err) {
      logError('auth', 'Signin failed', { error: err.message })
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/auth/me', async (req, res) => {
    try {
      const auth = req.headers.authorization
      if (!auth) return res.status(401).json({ error: 'No token' })
      const token = auth.split(' ')[1]
      const payload = jwt.verify(token, getJwtSecret())
      const col = getCollection('users')
      const user = await col.findOne({ _id: payload.sub })
      if (!user) return res.status(404).json({ error: 'User not found' })
      const { password: _, ...safe } = user
      res.json(safe)
    } catch {
      res.status(401).json({ error: 'Invalid token' })
    }
  })

  app.patch('/auth/me', requireAuth, async (req, res) => {
    try {
      const { name } = req.body
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name is required' })
      }
      const col = getCollection('users')
      if (!col) return res.status(500).json({ error: 'DB not connected' })
      const trimmed = name.trim().slice(0, 100)
      await col.updateOne({ _id: req.userId }, { $set: { name: trimmed, updated_at: new Date() } })
      const user = await col.findOne({ _id: req.userId })
      if (!user) return res.status(404).json({ error: 'User not found' })
      const { password: _, ...safe } = user
      res.json(safe)
    } catch (err) {
      logError('auth', 'Profile update failed', { userId: req.userId, error: err.message })
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/auth/account', requireAuth, async (req, res) => {
    try {
      const userId = req.userId
      info('auth', 'Account deletion started', { userId })

      const wlCol = getCollection('watchlists')
      const watchlistIds = wlCol ? (await wlCol.find({ userId }).toArray()).map(w => w._id) : []
      if (watchlistIds.length) {
        await getCollection('watchlist_items')?.deleteMany({ watchlistId: { $in: watchlistIds } })
      }

      await Promise.all([
        getCollection('users')?.deleteOne({ _id: userId }),
        getCollection('agent_preferences')?.deleteMany({ userId }),
        getCollection('watchlists')?.deleteMany({ userId }),
        getCollection('portfolio_positions')?.deleteMany({ userId }),
        getCollection('recommendation_log')?.deleteMany({ userId }),
        getCollection('recommendation_outcomes')?.deleteMany({ userId }),
        getCollection('virtual_trades')?.deleteMany({ userId }),
        getCollection('notifications')?.deleteMany({ userId }),
        getCollection('push_subscriptions')?.deleteMany({ userId }),
        getCollection('portfolio_snapshots')?.deleteMany({ userId }),
        getCollection('scan_history')?.deleteMany({ userId }),
      ])
      info('auth', 'Account deleted', { userId })
      res.json({ ok: true, deleted: userId })
    } catch (err) {
      logError('auth', 'Account deletion failed', { userId: req.userId, error: err.message })
      res.status(500).json({ error: err.message })
    }
  })
}
