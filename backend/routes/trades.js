import { getCollection } from '../config/db.js'
import {
  createVirtualTrade,
  closeVirtualTrade,
  getVirtualTrades,
  getTradeStats,
  getVirtualCash,
  calculatePositionSize,
} from '../services/trades.js'
import { getPreferences } from '../services/preferences.js'
import { get_latest_price } from '../services/agent.js'

export function registerTradeRoutes(app) {
  app.post('/api/trades', async (req, res) => {
    try {
      const { userId, ticker, action, quantity, entry_price, signal_id, rationale } = req.body
      if (!userId || !ticker || !action) return res.status(400).json({ error: 'userId, ticker and action are required' })
      res.json(await createVirtualTrade({ userId, ticker, action, quantity, entry_price, signal_id, rationale }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.patch('/api/trades/:id/close', async (req, res) => {
    try {
      const { exit_price } = req.body
      if (!exit_price) return res.status(400).json({ error: 'exit_price is required' })
      const col = getCollection('virtual_trades')
      const { ObjectId } = await import('mongodb')
      let q
      try { q = { _id: new ObjectId(req.params.id) } } catch { q = { _id: req.params.id } }
      const tradeDoc = await col?.findOne(q)
      if (!tradeDoc || tradeDoc.userId !== req.userId) return res.status(404).json({ error: 'Trade not found' })
      res.json(await closeVirtualTrade(req.params.id, exit_price))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/trades', async (req, res) => {
    try {
      const { userId, status, ticker, limit } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getVirtualTrades(userId, { status, ticker, limit: limit ? Number(limit) : 50 }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/trades/stats', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getTradeStats(userId))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/cash', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getVirtualCash(userId))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/position-size', async (req, res) => {
    try {
      const { userId, ticker, confidence } = req.body
      if (!userId || !ticker) return res.status(400).json({ error: 'userId and ticker required' })
      const { virtual_cash } = await getVirtualCash(userId)
      const prefs = await getPreferences(userId)
      const price_doc = await get_latest_price(ticker.toUpperCase())
      if (!price_doc?.price) return res.status(404).json({ error: 'No price data' })
      const sizing = calculatePositionSize({
        virtual_cash,
        price: price_doc.price,
        confidence: confidence || 0.7,
        max_position_size_pct: prefs?.max_position_size_pct || 25,
        risk_tolerance: prefs?.risk_tolerance || 'moderate',
      })
      res.json({ ...sizing, ticker: ticker.toUpperCase(), price: price_doc.price, virtual_cash })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
