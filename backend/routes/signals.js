import { getCollection } from '../config/db.js'
import {
  getRecommendationsForUser,
  getRecommendationHistory,
  getRecommendationsByStatus,
  rejectRecommendation,
  recordFeedback,
} from '../services/agent.js'
import { virtualExecutionWorkflow } from '../application/workflows/index.js'
import { info, warn, error as logError } from '../lib/logger.js'

async function findOwnedRecommendation(req) {
  const col = getCollection('recommendation_log')
  const { ObjectId } = await import('mongodb')
  let q
  try { q = { _id: new ObjectId(req.params.id) } } catch { q = { _id: req.params.id } }
  const rec = await col?.findOne(q)
  return rec && rec.userId === req.userId ? rec : null
}

export function registerSignalRoutes(app) {
  app.get('/api/signals', async (req, res) => {
    try {
      const { userId, limit, signal: signalFilter, since, status } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getRecommendationsForUser(userId, {
        limit: limit ? Number(limit) : 50,
        since: since || null,
        signal: signalFilter || null,
        status: status || null,
      }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/signals/pending', async (req, res) => {
    try {
      const { userId, limit } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getRecommendationsByStatus(userId, 'generated', limit ? Number(limit) : 50))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/signals/completed', async (req, res) => {
    try {
      const { userId, limit } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getRecommendationsForUser(userId, {
        limit: limit ? Number(limit) : 50,
        status: 'completed',
      }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/signals/history', async (req, res) => {
    try {
      const { userId, limit } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getRecommendationHistory(userId, { limit: limit ? Number(limit) : 100 }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/signals/:id/approve', async (req, res) => {
    try {
      const rec = await findOwnedRecommendation(req)
      if (!rec) return res.status(404).json({ error: 'Recommendation not found' })
      if (rec.status !== 'generated') {
        return res.status(400).json({ error: `Cannot approve: recommendation is already ${rec.status}` })
      }

      const result = await virtualExecutionWorkflow.executeRecommendation({
        userId: req.userId,
        recommendation: rec,
        executionMode: 'manual',
      })
      if (!result.decision.allowed) {
        warn('signals', 'Execution validation failed', { userId: req.userId, ticker: rec.ticker, reason: result.decision.reason })
        return res.status(422).json({ error: result.decision.reason })
      }

      info('signals', 'Recommendation approved through workflow', { userId: req.userId, ticker: rec.ticker, signal: rec.signal, executed: result.executed })
      res.json({ recommendation: result.recommendation, trade: result.trade, sizing: result.decision.details?.sizing || null })
    } catch (err) {
      logError('signals', 'Approve failed', { id: req.params.id, error: err.message })
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/signals/:id/reject', async (req, res) => {
    try {
      const rec = await findOwnedRecommendation(req)
      if (!rec) return res.status(404).json({ error: 'Recommendation not found' })
      const result = await rejectRecommendation(req.params.id)
      info('signals', 'Recommendation rejected', { id: req.params.id })
      res.json(result)
    } catch (err) {
      logError('signals', 'Reject failed', { id: req.params.id, error: err.message })
      res.status(500).json({ error: err.message })
    }
  })

  app.patch('/api/signals/:id/feedback', async (req, res) => {
    try {
      const { user_action } = req.body
      if (!user_action) return res.status(400).json({ error: 'user_action is required' })
      const rec = await findOwnedRecommendation(req)
      if (!rec) return res.status(404).json({ error: 'Recommendation not found' })
      res.json(await recordFeedback(req.params.id, user_action))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
