import { get_portfolio, calculateSectorAllocation } from '../services/agent.js'
import { getLatestPricesBatch } from '../services/prices.js'
import { getPortfolioSummary } from '../services/trades.js'
import { getPortfolioIntelligence } from '../services/intelligence.js'
import { getPortfolioSnapshots, savePortfolioSnapshot } from '../services/learning.js'

export function registerPortfolioRoutes(app) {
  app.get('/api/portfolio', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      const positions = await get_portfolio(userId)
      if (!positions?.length) return res.json([])

      const priceMap = await getLatestPricesBatch(positions.map(p => p.ticker))
      const enriched = positions.map(pos => {
        const latest = priceMap.get(pos.ticker)
        const current_price = latest?.price != null ? Number(latest.price) : null
        const current_value = current_price != null ? Number((current_price * Number(pos.quantity)).toFixed(2)) : null
        const pnl = current_value != null ? Number((current_value - Number(pos.average_price) * Number(pos.quantity)).toFixed(2)) : null
        const pnl_pct = pnl != null && pos.average_price > 0 ? Number(((current_price - Number(pos.average_price)) / Number(pos.average_price) * 100).toFixed(3)) : null
        return { ...pos, current_price, current_value, pnl, pnl_pct }
      })
      res.json(enriched)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/portfolio/summary', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getPortfolioSummary(userId))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/portfolio/sectors', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await calculateSectorAllocation(userId))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/portfolio/intelligence', async (req, res) => {
    try {
      res.json(await getPortfolioIntelligence(req.userId))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/portfolio/history', async (req, res) => {
    try {
      const { userId, days } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getPortfolioSnapshots(userId, days ? Number(days) : 30))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/portfolio/snapshot', async (req, res) => {
    try {
      const { userId } = req.body
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      const snap = await savePortfolioSnapshot(userId)
      res.json(snap || { ok: false })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
