import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { connect, getDb, getCollection } from "./config/db.js"
import { requireAuth } from "./middleware/auth.js"
import {
  get_portfolio, get_latest_price, get_watchlist, get_price_context, get_market_news,
  getWatchlists, getWatchlistItems, getRecommendationsForUser,
  getLatestRecommendationsForTickers, recordFeedback, saveRecommendation, calculateSectorAllocation,
  approveRecommendation, rejectRecommendation, executeRecommendation, getRecommendationsByStatus,
  createWatchlist, addWatchlistItem
} from "./services/agent.js"
import { getLatestPricesBatch } from "./services/prices.js"
import { startWebSocket, stopWebSocket, getSubscribedTickers } from "./services/websocket.js"
import { addClient, removeClient, getClientCount } from "./services/sse.js"
import { getPreferences, createDefaultPreferences, updatePreferences } from "./services/preferences.js"
import { createVirtualTrade, closeVirtualTrade, getVirtualTrades, getTradeStats, validateExecution, getVirtualCash, calculatePositionSize } from "./services/trades.js"
import { createNotification, getNotifications, markRead, markAllRead, getUnreadCount } from "./services/notifications.js"
import { runAgent } from "./agent/index.js"
import { startScheduler, triggerManualScan, getNextScanTime } from "./services/scheduler.js"
import { initPush, getPublicKey, subscribe as pushSubscribe, unsubscribe as pushUnsubscribe } from "./services/push.js"
import { getPortfolioIntelligence } from "./services/intelligence.js"

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }))
app.use(express.json())

app.get('/', (_req, res) => res.type('text/plain').send('StockSense backend'))

app.get('/health', async (_req, res) => {
  const mcpUrl = process.env.MCP_SERVER_URL || 'http://localhost:8080/mcp'
  let mcpStatus = 'disconnected'
  try {
    const r = await fetch(mcpUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'healthcheck', version: '1.0' } } }), signal: AbortSignal.timeout(3000) })
    if (r.ok) mcpStatus = 'connected'
  } catch {}
  res.json({
    status: 'ok',
    mongodb: getDb() ? 'connected' : 'disconnected',
    websocket: getSubscribedTickers().length > 0 ? 'connected' : 'disconnected',
    mcp: mcpStatus,
    agent: 'ready'
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

// ─── Auth ──────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })
    const col = getCollection('users')
    if (!col) return res.status(500).json({ error: 'DB not connected' })
    const existing = await col.findOne({ email: email.toLowerCase().trim() })
    if (existing) return res.status(409).json({ error: 'Email already registered' })
    const hash = await bcrypt.hash(password, 10)
    const userId = `user_${Date.now()}`
    const doc = {
      _id: userId,
      email: email.toLowerCase().trim(),
      password: hash,
      name: name || email.split('@')[0],
      risk_tolerance: 'moderate',
      investment_horizon: 'medium',
      preferred_sectors: [],
      experience_level: 'intermediate',
      virtual_cash: 100000,
      starting_capital: 100000,
      created_at: new Date(),
      updated_at: new Date()
    }
    await col.insertOne(doc)
    await createDefaultPreferences(userId)
    const token = jwt.sign({ sub: userId, email: doc.email }, JWT_SECRET, { expiresIn: '7d' })
    const { password: _, ...user } = doc
    res.json({ token, user })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already registered' })
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
    const token = jwt.sign({ sub: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
    const { password: _, ...safe } = user
    res.json({ token, user: safe })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/auth/me', async (req, res) => {
  try {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'No token' })
    const token = auth.split(' ')[1]
    const payload = jwt.verify(token, JWT_SECRET)
    const col = getCollection('users')
    const user = await col.findOne({ _id: payload.sub })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { password: _, ...safe } = user
    res.json(safe)
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' })
  }
})

app.delete('/auth/account', requireAuth, async (req, res) => {
  try {
    const userId = req.userId
    await Promise.all([
      getCollection('users')?.deleteOne({ _id: userId }),
      getCollection('agent_preferences')?.deleteMany({ userId }),
      getCollection('watchlists')?.deleteMany({ userId }),
      getCollection('watchlist_items')?.deleteMany({ watchlistId: { $exists: true } }),
      getCollection('portfolio_positions')?.deleteMany({ userId }),
      getCollection('recommendation_log')?.deleteMany({ userId }),
      getCollection('virtual_trades')?.deleteMany({ userId }),
      getCollection('notifications')?.deleteMany({ userId }),
      getCollection('push_subscriptions')?.deleteMany({ userId }),
    ])
    const wlCol = getCollection('watchlists')
    if (wlCol) {
      const wls = await wlCol.find({ userId }).toArray()
      if (wls.length) {
        const ids = wls.map(w => w._id)
        await getCollection('watchlist_items')?.deleteMany({ watchlistId: { $in: ids } })
      }
    }
    res.json({ ok: true, deleted: userId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
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

// ─── Action Center (Recommendation Lifecycle) ─────────────────────────────────

app.get('/api/actions/pending', async (req, res) => {
  try {
    const { userId, limit } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    res.json(await getRecommendationsByStatus(userId, 'generated', limit ? Number(limit) : 50))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/actions/completed', async (req, res) => {
  try {
    const { userId, limit } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const col = getCollection('recommendation_log')
    if (!col) return res.json([])
    const results = await col.find({
      userId,
      status: { $in: ['executed', 'approved', 'rejected', 'expired'] }
    }).sort({ created_at: -1 }).limit(limit ? Number(limit) : 50).toArray()
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/actions/:id/approve', async (req, res) => {
  try {
    const col = getCollection('recommendation_log')
    const { ObjectId } = await import('mongodb')
    let q
    try { q = { _id: new ObjectId(req.params.id) } } catch { q = { _id: req.params.id } }
    const rec = await col.findOne(q)
    if (!rec) return res.status(404).json({ error: 'Recommendation not found' })

    const action = rec.signal === 'BUY' ? 'BUY' : rec.signal === 'EXIT' ? 'SELL' : null

    // For non-tradeable signals (HOLD, WATCH, REBALANCE), just mark as executed
    if (!action) {
      const result = await executeRecommendation(req.params.id)
      return res.json({ recommendation: result, trade: null, sizing: null })
    }

    // For BUY/EXIT — approve AND execute in one step
    const price_doc = await get_latest_price(rec.ticker)
    const price = price_doc?.price
    if (!price) return res.status(422).json({ error: `No current price for ${rec.ticker}` })

    const validation = await validateExecution({ userId: rec.userId, ticker: rec.ticker, action, confidence: rec.confidence, price })
    if (!validation.allowed) return res.status(422).json({ error: validation.reason })

    const prefs = await getPreferences(rec.userId)
    const { virtual_cash } = await getVirtualCash(rec.userId)
    const sizing = calculatePositionSize({ virtual_cash, price, confidence: rec.confidence, max_position_size_pct: prefs?.max_position_size_pct || 25, risk_tolerance: prefs?.risk_tolerance || 'moderate' })

    const executed = await executeRecommendation(req.params.id)
    const trade = await createVirtualTrade({
      userId: rec.userId, ticker: rec.ticker, action,
      quantity: sizing.quantity, entry_price: price,
      signal_id: rec._id?.toString(), rationale: rec.rationale
    })

    await createNotification({
      userId: rec.userId, type: 'trade_executed',
      title: `${action} ${rec.ticker} - ${sizing.quantity} shares @ $${price.toFixed(2)}`,
      message: rec.rationale?.slice(0, 120) || '',
      ticker: rec.ticker, recId: rec._id?.toString()
    })

    res.json({ recommendation: executed, trade, sizing })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/actions/:id/reject', async (req, res) => {
  try {
    res.json(await rejectRecommendation(req.params.id))
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

// ─── Agent Preferences ────────────────────────────────────────────────────────

app.get('/api/preferences', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const prefs = await getPreferences(userId)
    res.json(prefs || {})
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/preferences', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const prefs = await createDefaultPreferences(userId)
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/preferences', async (req, res) => {
  try {
    const { userId, ...updates } = req.body
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const prefs = await updatePreferences(userId, updates)
    res.json(prefs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Virtual Trades ───────────────────────────────────────────────────────────

app.post('/api/trades', async (req, res) => {
  try {
    const { userId, ticker, action, quantity, entry_price, signal_id, rationale } = req.body
    if (!userId || !ticker || !action) return res.status(400).json({ error: 'userId, ticker, and action are required' })
    const trade = await createVirtualTrade({ userId, ticker, action, quantity, entry_price, signal_id, rationale })
    res.json(trade)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/trades/:id/close', async (req, res) => {
  try {
    const { exit_price } = req.body
    if (!exit_price) return res.status(400).json({ error: 'exit_price is required' })
    const trade = await closeVirtualTrade(req.params.id, exit_price)
    res.json(trade)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/trades', async (req, res) => {
  try {
    const { userId, status, ticker, limit } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const trades = await getVirtualTrades(userId, { status, ticker, limit: limit ? Number(limit) : 50 })
    res.json(trades)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/trades/stats', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const stats = await getTradeStats(userId)
    res.json(stats)
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
    const sizing = calculatePositionSize({ virtual_cash, price: price_doc.price, confidence: confidence || 0.7, max_position_size_pct: prefs?.max_position_size_pct || 25, risk_tolerance: prefs?.risk_tolerance || 'moderate' })
    res.json({ ...sizing, ticker: ticker.toUpperCase(), price: price_doc.price, virtual_cash })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Push Notifications ───────────────────────────────────────────────────────

app.get('/api/push/public-key', (_req, res) => {
  res.json({ publicKey: getPublicKey() })
})

app.post('/api/push/subscribe', requireAuth, async (req, res) => {
  try {
    const { subscription } = req.body
    if (!subscription) return res.status(400).json({ error: 'subscription required' })
    await pushSubscribe(req.userId, subscription)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/push/unsubscribe', requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' })
    res.json(await pushUnsubscribe(req.userId, endpoint))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Portfolio Intelligence ───────────────────────────────────────────────────

app.get('/api/portfolio/intelligence', requireAuth, async (req, res) => {
  try {
    res.json(await getPortfolioIntelligence(req.userId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Notifications ────────────────────────────────────────────────────────────

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

// ─── Onboarding Complete ──────────────────────────────────────────────────────

app.post('/api/onboarding/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.userId
    const { risk, horizon, sectors, watchlist } = req.body

    // Map onboarding answers to preference values
    const riskMap = { Conservative: 'conservative', Moderate: 'moderate', Aggressive: 'aggressive' }
    const horizonMap = { 'Short (< 1 year)': 'short', 'Medium (1-5 years)': 'medium', 'Long (5+ years)': 'long' }

    // Update user profile
    const usersCol = getCollection('users')
    if (usersCol) {
      const userUpdates = {}
      if (risk && riskMap[risk]) userUpdates.risk_tolerance = riskMap[risk]
      if (horizon && horizonMap[horizon]) userUpdates.investment_horizon = horizonMap[horizon]
      if (sectors) userUpdates.preferred_sectors = [sectors]
      userUpdates.onboarding_completed = true
      userUpdates.updated_at = new Date()
      await usersCol.updateOne({ _id: userId }, { $set: userUpdates })
    }

    // Update agent_preferences
    const prefUpdates = {}
    if (risk && riskMap[risk]) prefUpdates.risk_tolerance = riskMap[risk]
    if (horizon && horizonMap[horizon]) prefUpdates.investment_horizon = horizonMap[horizon]
    if (sectors) prefUpdates.preferred_sectors = [sectors]
    if (Object.keys(prefUpdates).length > 0) {
      await updatePreferences(userId, prefUpdates)
    }

    // Create watchlist and add tickers
    let watchlistResult = null
    if (watchlist && watchlist !== 'Skipped' && watchlist.length > 0) {
      const wl = await createWatchlist({ userId, name: 'My Watchlist' })
      const tickers = typeof watchlist === 'string' ? watchlist.split(',').map(t => t.trim()).filter(Boolean) : watchlist
      for (const ticker of tickers) {
        await addWatchlistItem({ watchlistId: wl._id, ticker, sector: sectors || null })
      }
      watchlistResult = { id: wl._id, name: wl.name, tickers }
    }

    res.json({ ok: true, watchlist: watchlistResult })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Stock Search (Twelve Data Symbol Search) ─────────────────────────────────

app.get('/api/stocks/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query
    if (!q || q.length < 2) return res.json([])
    const apiKey = process.env.TWELVEDATA_API_KEY
    if (!apiKey) return res.status(503).json({ error: 'Stock search unavailable (no API key)' })
    const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=10&apikey=${apiKey}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return res.status(502).json({ error: 'Twelve Data API error' })
    const json = await resp.json()
    const results = (json.data || []).slice(0, 10).map(item => ({
      symbol: item.symbol,
      name: item.instrument_name,
      exchange: item.exchange,
      country: item.country,
      type: item.instrument_type,
    }))
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── ADK Agent ─────────────────────────────────────────────────────────────────

app.post('/agent/chat', async (req, res) => {
  try {
    const { userId, message } = req.body
    if (!userId || !message) return res.status(400).json({ error: 'userId and message are required' })
    const contextMessage = `[User: ${userId}] ${message}`
    const result = await runAgent(userId, contextMessage)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/agent/scan', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const result = await triggerManualScan(userId)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/activity', async (req, res) => {
  try {
    const { userId, limit } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const notifications = await getNotifications(userId, { limit: limit ? Number(limit) : 20 })
    res.json(notifications)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const [cash, stats, pendingCount, prefs, latestRec] = await Promise.all([
      getVirtualCash(userId),
      getTradeStats(userId),
      getRecommendationsByStatus(userId, 'generated', 999).then(r => r.length),
      getPreferences(userId),
      getRecommendationsByStatus(userId, null, 1).then(r => r[0] || null),
    ])
    const positions = await get_portfolio(userId) || []
    const tickers = positions.map(p => p.ticker)
    let equity = cash.virtual_cash
    if (tickers.length) {
      const priceMap = await getLatestPricesBatch(tickers)
      for (const pos of positions) {
        const p = priceMap.get(pos.ticker)
        if (p?.price) equity += p.price * Number(pos.quantity)
      }
    }
    const unrealized_pnl = Number((equity - cash.virtual_cash - positions.reduce((s, p) => s + Number(p.average_price) * Number(p.quantity), 0)).toFixed(2))
    res.json({
      virtual_cash: cash.virtual_cash,
      starting_capital: cash.starting_capital,
      equity: Number(equity.toFixed(2)),
      portfolio_return_pct: Number(((equity - cash.starting_capital) / cash.starting_capital * 100).toFixed(2)),
      realized_pnl: stats.total_pnl,
      unrealized_pnl,
      open_positions: positions.length,
      open_trades: stats.open_trades,
      win_rate: stats.win_rate,
      total_trades: stats.total_trades,
      pending_actions: pendingCount,
      mode: prefs?.mode || 'default',
      next_scan: getNextScanTime(prefs?.signal_frequency || 'daily').toISOString(),
      latest_recommendation: latestRec ? { ticker: latestRec.ticker, signal: latestRec.signal, confidence: latestRec.confidence, confidence_delta: latestRec.confidence_delta, created_at: latestRec.created_at } : null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/agent/run', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId is required' })

    const prefs = await getPreferences(userId)
    const mode = prefs?.mode || 'default'
    const minConfidence = prefs?.min_confidence || 0.7

    const prompt = `Analyze the full portfolio for user ${userId}. For every ticker in the portfolio and watchlist:
1. Get the latest price
2. Get price context (technicals)
3. Get market news
4. Generate and SAVE a recommendation for each ticker

After saving all recommendations, provide a brief portfolio summary with your key findings.`

    const result = await runAgent(userId, prompt)

    if (mode === 'agentic') {
      const pending = await getRecommendationsByStatus(userId, 'generated', 20)
      const { virtual_cash } = await getVirtualCash(userId)
      const executed = []
      for (const rec of pending) {
        if ((rec.signal === 'BUY' || rec.signal === 'EXIT')) {
          const action = rec.signal === 'BUY' ? 'BUY' : 'SELL'
          const price_doc = await get_latest_price(rec.ticker)
          const price = price_doc?.price
          if (!price) continue
          const validation = await validateExecution({ userId, ticker: rec.ticker, action, confidence: rec.confidence, price })
          if (!validation.allowed) continue
          try {
            const sizing = calculatePositionSize({ virtual_cash, price, confidence: rec.confidence, max_position_size_pct: prefs?.max_position_size_pct || 25, risk_tolerance: prefs?.risk_tolerance || 'moderate' })
            const execd = await executeRecommendation(rec._id.toString())
            await createVirtualTrade({ userId, ticker: rec.ticker, action, quantity: sizing.quantity, entry_price: price, signal_id: rec._id.toString(), rationale: rec.rationale })
            await createNotification({ userId, type: 'auto_executed', title: `Auto ${action} ${rec.ticker} - ${sizing.quantity} shares @ $${price.toFixed(2)}`, message: rec.rationale?.slice(0, 100) || '', ticker: rec.ticker, recId: rec._id.toString() })
            executed.push(execd)
          } catch {}
        }
      }
      result.mode = 'agentic'
      result.auto_executed = executed.length
    } else {
      result.mode = 'default'
      result.auto_executed = 0
    }

    res.json(result)
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
  initPush()
  startScheduler()
}

process.on('SIGTERM', () => { stopWebSocket(); process.exit(0) })
process.on('SIGINT',  () => { stopWebSocket(); process.exit(0) })
start()
