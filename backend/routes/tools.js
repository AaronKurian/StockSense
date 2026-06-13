import {
  get_latest_price,
  get_price_context,
  get_market_news,
  get_portfolio,
  get_watchlist,
  saveRecommendation,
  recordFeedback,
} from '../services/agent.js'

export function registerToolRoutes(app) {
  app.get('/tools/get_latest_price', async (req, res) => {
    try {
      const { ticker } = req.query
      if (!ticker) return res.status(400).json({ error: 'ticker is required' })
      const t = ticker.toUpperCase()
      const doc = await get_latest_price(t)
      res.json(doc || { ticker: t, price: null, volume: null, change_percent: null, updated_at: null })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/tools/get_price_context', async (req, res) => {
    try {
      const { ticker } = req.query
      if (!ticker) return res.status(400).json({ error: 'ticker is required' })
      const t = ticker.toUpperCase()
      const ctx = await get_price_context(t)
      if (!ctx) return res.status(404).json({ error: `No price context for ${t}` })
      res.json(ctx)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/tools/get_market_news', async (req, res) => {
    try {
      const { ticker } = req.query
      if (!ticker) return res.status(400).json({ error: 'ticker is required' })
      res.json(await get_market_news(ticker.toUpperCase()))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/tools/get_portfolio', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await get_portfolio(userId) || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/tools/get_watchlist', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await get_watchlist(userId) || [])
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/tools/save_recommendation', async (req, res) => {
    try {
      const { userId, ticker, signal, confidence, rationale, supporting_factors, risks } = req.body
      if (!userId || !ticker || !signal) return res.status(400).json({ error: 'userId, ticker and signal are required' })
      res.json(await saveRecommendation({ userId, ticker, signal, confidence, rationale, supporting_factors, risks }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/tools/record_feedback', async (req, res) => {
    try {
      const { recId, user_action } = req.body
      if (!recId || !user_action) return res.status(400).json({ error: 'recId and user_action are required' })
      res.json(await recordFeedback(recId, user_action))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
