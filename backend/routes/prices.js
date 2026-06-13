import { get_latest_price } from '../services/agent.js'
import { logApiUsage } from '../lib/apiUsage.js'

export function registerPriceRoutes(app) {
  app.get('/api/prices/:ticker', async (req, res) => {
    try {
      const doc = await get_latest_price(req.params.ticker.toUpperCase())
      if (!doc) return res.status(404).json({ error: 'No price data for ticker' })
      res.json(doc)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/stocks/search', async (req, res) => {
    try {
      const { q } = req.query
      if (!q || q.length < 2) return res.json([])
      const apiKey = process.env.TWELVEDATA_API_KEY
      if (!apiKey) return res.status(503).json({ error: 'Stock search unavailable (no API key)' })
      logApiUsage({ provider: 'twelvedata', endpoint: 'symbol_search', ticker: q, source: 'stock_search' })
      const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=10&apikey=${apiKey}`
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!resp.ok) return res.status(502).json({ error: 'Twelve Data API error' })
      const json = await resp.json()
      res.json((json.data || []).slice(0, 10).map(item => ({
        symbol: item.symbol,
        name: item.instrument_name,
        exchange: item.exchange,
        country: item.country,
        type: item.instrument_type,
      })))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
