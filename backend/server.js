import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { connect, getDb } from "./config/db.js"
import {
  get_portfolio, get_latest_price, get_watchlist, get_price_context, get_market_news,
  getWatchlists, getWatchlistItems, getRecommendationsForUser,
  getLatestRecommendationsForTickers, recordFeedback, saveRecommendation, calculateSectorAllocation
} from "./services/agent.js"
import { getLatestPricesBatch } from "./services/prices.js"
import { startWebSocket, stopWebSocket, getSubscribedTickers } from "./services/websocket.js"
import { addClient, removeClient, getClientCount } from "./services/sse.js"

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }))
app.use(express.json())

app.get('/', (_req, res) => res.type('text/plain').send('StockSense backend'))

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mongodb: getDb() ? 'connected' : 'disconnected',
    websocket: getSubscribedTickers().length > 0 ? 'connected' : 'disconnected'
  })
})

app.get('/api/ws/status', (_req, res) => {
  res.json({ subscribed_count: getSubscribedTickers().length, tickers: getSubscribedTickers() })
})

app.get('/api/prices/stream', (req, res) => {
  addClient(res)
  req.on('close', () => removeClient(res))
})

app.get('/api/prices/stream/status', (_req, res) => {
  res.json({ connected_clients: getClientCount() })
})

// ─── Portfolio ────────────────────────────────────────────────────────────────

app.get('/api/portfolio', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const positions = await get_portfolio(userId)
    if (!positions?.length) return res.json([])

    const tickers = positions.map(p => p.ticker)
    const priceMap = await getLatestPricesBatch(tickers)

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

app.get('/api/portfolio/sectors', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    res.json(await calculateSectorAllocation(userId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Watchlists ───────────────────────────────────────────────────────────────

app.get('/api/watchlists', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    res.json(await getWatchlists(userId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/watchlists/:watchlistId/items', async (req, res) => {
  try {
    const { watchlistId } = req.params
    const { userId } = req.query
    const items = await getWatchlistItems(watchlistId)
    if (!items.length) return res.json([])

    const tickers = items.map(i => i.ticker)
    const [priceMap, recMap] = await Promise.all([
      getLatestPricesBatch(tickers),
      userId ? getLatestRecommendationsForTickers(userId, tickers) : Promise.resolve(new Map())
    ])

    const enriched = items.map(item => {
      const latest = priceMap.get(item.ticker)
      const rec = recMap.get(item.ticker)
      return {
        ...item,
        price:          latest?.price ?? null,
        change_percent: latest?.change_percent ?? null,
        volume:         latest?.volume ?? null,
        updated_at:     latest?.updated_at ?? null,
        signal:         rec ? { type: rec.signal, confidence: Math.round((rec.confidence ?? 0) * 100) } : null
      }
    })
    res.json(enriched)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Signals ──────────────────────────────────────────────────────────────────

app.get('/api/signals', async (req, res) => {
  try {
    const { userId, limit, signal: signalFilter, since } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    res.json(await getRecommendationsForUser(userId, {
      limit: limit ? Number(limit) : 50,
      since: since || null,
      signal: signalFilter || null
    }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/signals/:id/feedback', async (req, res) => {
  try {
    const { user_action } = req.body
    if (!user_action) return res.status(400).json({ error: 'user_action is required' })
    res.json(await recordFeedback(req.params.id, user_action))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Prices ───────────────────────────────────────────────────────────────────

app.get('/api/prices/:ticker', async (req, res) => {
  try {
    const doc = await get_latest_price(req.params.ticker.toUpperCase())
    if (!doc) return res.status(404).json({ error: 'No price data for ticker' })
    res.json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Agent Builder Tool Endpoints ─────────────────────────────────────────────

app.get('/tools/get_latest_price', async (req, res) => {
  try {
    const { ticker } = req.query
    if (!ticker) return res.status(400).json({ error: 'ticker is required' })
    const doc = await get_latest_price(ticker.toUpperCase())
    res.json(doc || { ticker: ticker.toUpperCase(), price: null, volume: null, change_percent: null, updated_at: null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/tools/get_price_context', async (req, res) => {
  try {
    const { ticker } = req.query
    if (!ticker) return res.status(400).json({ error: 'ticker is required' })
    const ctx = await get_price_context(ticker.toUpperCase())
    res.json(ctx || { current_price: null, seven_day_change_pct: null, thirty_day_change_pct: null, trend: null, above_50dma: null, above_200dma: null, volume_spike: null })
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
    if (!userId || !ticker || !signal) return res.status(400).json({ error: 'userId, ticker, and signal are required' })
    const saved = await saveRecommendation({ userId, ticker, signal, confidence, rationale, supporting_factors, risks })
    res.json(saved)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/tools/record_feedback', async (req, res) => {
  try {
    const { recId, user_action } = req.body
    if (!recId || !user_action) return res.status(400).json({ error: 'recId and user_action are required' })
    const updated = await recordFeedback(recId, user_action)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  try { await connect(process.env.MONGODB_URI) } catch (err) { console.warn('DB connect failed:', err.message) }
  app.listen(port, () => console.log(`Listening on http://localhost:${port}`))
  if (process.env.TWELVEDATA_API_KEY) startWebSocket()
  else console.warn('[ws] TWELVEDATA_API_KEY not set')
}

process.on('SIGTERM', () => { stopWebSocket(); process.exit(0) })
process.on('SIGINT',  () => { stopWebSocket(); process.exit(0) })
start()
