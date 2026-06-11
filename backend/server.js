import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { connect, getDb, getCollection } from "./config/db.js"
import { requireAuth } from "./middleware/auth.js"
import {
  get_portfolio, get_latest_price, get_watchlist, get_price_context, get_market_news,
  getWatchlists, getWatchlistItems, getRecommendationsForUser, getRecommendationHistory,
  getLatestRecommendationsForTickers, recordFeedback, saveRecommendation, calculateSectorAllocation,
  approveRecommendation, rejectRecommendation, executeRecommendation, getRecommendationsByStatus,
  createWatchlist, addWatchlistItem, removeWatchlistItem, getOrCreatePrimaryWatchlist, getScanTickers
} from "./services/agent.js"
import { getMetadataBatch, getTickerMetadata } from "./services/metadata.js"
import { resolveLatestPrice, getMarketDataFreshness } from "./services/prices.js"
import { getApiUsageSummary } from "./lib/apiUsage.js"
import { logApiUsage } from "./lib/apiUsage.js"
import { resolveSector } from "./lib/sectors.js"
import { getLatestPricesBatch } from "./services/prices.js"
import { startWebSocket, stopWebSocket, getSubscribedTickers } from "./services/websocket.js"
import { addClient, removeClient, getClientCount } from "./services/sse.js"
import { getPreferences, createDefaultPreferences, updatePreferences } from "./services/preferences.js"
import { createVirtualTrade, closeVirtualTrade, getVirtualTrades, getTradeStats, validateExecution, getVirtualCash, calculatePositionSize, markToMarket, getPortfolioSummary } from "./services/trades.js"
import { createNotification, getNotifications, markRead, markAllRead, getUnreadCount } from "./services/notifications.js"
import { runAutonomousExecution, acquireScanLock, releaseScanLock } from "./services/autonomy.js"
import { runAgent } from "./agent/index.js"
import { startScheduler, triggerManualScan, getNextScanTime } from "./services/scheduler.js"
import { initPush, getPublicKey, subscribe as pushSubscribe, unsubscribe as pushUnsubscribe } from "./services/push.js"
import { getPortfolioIntelligence } from "./services/intelligence.js"
import { parseOnboardingSectors } from "./lib/sectors.js"
import { getPortfolioSnapshots, getConfidenceCalibration, getSignalPerformance, generateDailyBriefing, savePortfolioSnapshot, evaluateRecommendationOutcomes, runNightlyJobs } from "./services/learning.js"
import { info, warn, error as logError, requestLogger } from "./lib/logger.js"

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }))
app.use(express.json())
app.use(requestLogger)

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
    const token = jwt.sign({ sub: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })
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

app.get('/api/watchlists', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    res.json(await getWatchlists(userId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/watchlists/managed', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const prefs = await getPreferences(userId)
    const maxStocks = prefs?.max_stocks || 15
    const wl = await getOrCreatePrimaryWatchlist(userId)
    const items = await getWatchlistItems(wl._id)
    const metaMap = items.length ? await getMetadataBatch(items.map(i => i.ticker)) : new Map()
    res.json({
      watchlistId: wl._id,
      max_stocks: maxStocks,
      count: items.length,
      items: items.map(i => ({
        ticker: i.ticker,
        name: i.name || metaMap.get(i.ticker)?.name || i.ticker,
        sector: i.sector || metaMap.get(i.ticker)?.sector || null,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/watchlists/managed/items', async (req, res) => {
  try {
    const { userId, ticker, name, sector } = req.body
    if (!userId || !ticker) return res.status(400).json({ error: 'userId and ticker are required' })
    const prefs = await getPreferences(userId)
    const maxStocks = prefs?.max_stocks || 15
    const wl = await getOrCreatePrimaryWatchlist(userId)
    const items = await getWatchlistItems(wl._id)
    const t = String(ticker).trim().toUpperCase()
    if (!items.find(i => i.ticker === t) && items.length >= maxStocks) {
      return res.status(400).json({ error: `Maximum ${maxStocks} stocks monitored` })
    }
    const meta = await getTickerMetadata(t)
    const resolvedSector = resolveSector(t, meta.sector, sector)
    await addWatchlistItem({ watchlistId: wl._id, ticker: t, name: name || meta.name, sector: resolvedSector })
    resolveLatestPrice(t).catch(() => {})
    const updated = await getWatchlistItems(wl._id)
    const metaMap = updated.length ? await getMetadataBatch(updated.map(i => i.ticker)) : new Map()
    res.json({
      watchlistId: wl._id,
      max_stocks: maxStocks,
      count: updated.length,
      items: updated.map(i => ({
        ticker: i.ticker,
        name: i.name || metaMap.get(i.ticker)?.name || i.ticker,
        sector: i.sector || metaMap.get(i.ticker)?.sector || null,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/watchlists/managed/items/:ticker', async (req, res) => {
  try {
    const { userId } = req.query
    const { ticker } = req.params
    if (!userId || !ticker) return res.status(400).json({ error: 'userId and ticker are required' })
    const prefs = await getPreferences(userId)
    const maxStocks = prefs?.max_stocks || 15
    const wl = await getOrCreatePrimaryWatchlist(userId)
    await removeWatchlistItem({ watchlistId: wl._id, ticker })
    const items = await getWatchlistItems(wl._id)
    const metaMap = items.length ? await getMetadataBatch(items.map(i => i.ticker)) : new Map()
    res.json({
      watchlistId: wl._id,
      max_stocks: maxStocks,
      count: items.length,
      items: items.map(i => ({
        ticker: i.ticker,
        name: i.name || metaMap.get(i.ticker)?.name || i.ticker,
        sector: i.sector || metaMap.get(i.ticker)?.sector || null,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/watchlists/:watchlistId/items', async (req, res) => {
  try {
    const { watchlistId } = req.params
    if (!watchlistId || watchlistId === 'null' || watchlistId === 'undefined') {
      return res.status(400).json({ error: 'watchlistId is required' })
    }
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
    const col = getCollection('recommendation_log')
    const { ObjectId } = await import('mongodb')
    let q
    try { q = { _id: new ObjectId(req.params.id) } } catch { q = { _id: req.params.id } }
    const rec = await col.findOne(q)
    if (!rec) return res.status(404).json({ error: 'Recommendation not found' })

    if (rec.status !== 'generated') {
      return res.status(400).json({ error: `Cannot approve: recommendation is already ${rec.status}` })
    }

    const action = rec.signal === 'BUY' ? 'BUY' : rec.signal === 'EXIT' ? 'SELL' : null

    if (!action) {
      const result = await executeRecommendation(req.params.id, { execution_mode: 'manual' })
      info('signals', 'Non-tradeable signal approved', { userId: rec.userId, ticker: rec.ticker, signal: rec.signal })
      return res.json({ recommendation: result, trade: null, sizing: null })
    }

    const price_doc = await get_latest_price(rec.ticker)
    const price = price_doc?.price
    if (!price) return res.status(422).json({ error: `No current price for ${rec.ticker}` })

    const validation = await validateExecution({ userId: rec.userId, ticker: rec.ticker, action, confidence: rec.confidence, price })
    if (!validation.allowed) {
      warn('signals', 'Execution validation failed', { userId: rec.userId, ticker: rec.ticker, reason: validation.reason })
      return res.status(422).json({ error: validation.reason })
    }

    const prefs = await getPreferences(rec.userId)

    let quantity, sizing
    if (action === 'BUY') {
      const { virtual_cash } = await getVirtualCash(rec.userId)
      sizing = calculatePositionSize({
        virtual_cash, price, confidence: rec.confidence,
        max_position_size_pct: prefs?.max_position_size_pct ?? 20,
        risk_tolerance: prefs?.risk_tolerance || 'moderate',
        cash_reserve_pct: prefs?.cash_reserve_pct ?? 10,
      })
      quantity = sizing.quantity
    } else {
      const position = await getCollection('portfolio_positions')?.findOne({ userId: rec.userId, ticker: rec.ticker })
      quantity = position ? Math.floor(Number(position.quantity)) : 0
      if (quantity <= 0) return res.status(422).json({ error: `No ${rec.ticker} position to exit` })
      sizing = { quantity, note: 'full position exit' }
    }

    const executed = await executeRecommendation(req.params.id, { execution_mode: 'manual' })
    const trade = await createVirtualTrade({
      userId: rec.userId, ticker: rec.ticker, action,
      quantity, entry_price: price,
      signal_id: rec._id?.toString(), rationale: rec.rationale
    })

    const { formatTradeTitle, formatTradeMessage } = await import('./services/notifications.js')
    await createNotification({
      userId: rec.userId,
      type: 'trade_executed',
      title: formatTradeTitle(action, rec.ticker),
      message: formatTradeMessage({ quantity, price, mode: 'manual' }),
      ticker: rec.ticker,
      recId: rec._id?.toString(),
    })

    info('signals', 'Trade executed via approve', { userId: rec.userId, ticker: rec.ticker, action, quantity, price })
    res.json({ recommendation: executed, trade, sizing })
  } catch (err) {
    logError('signals', 'Approve failed', { id: req.params.id, error: err.message })
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/signals/:id/reject', async (req, res) => {
  try {
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
    res.json(await recordFeedback(req.params.id, user_action))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/prices/:ticker', async (req, res) => {
  try {
    const doc = await get_latest_price(req.params.ticker.toUpperCase())
    if (!doc) return res.status(404).json({ error: 'No price data for ticker' })
    res.json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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
    if (!ctx) return res.status(404).json({ error: `No price context for ${ticker.toUpperCase()}` })
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

app.post('/api/trades', async (req, res) => {
  try {
    const { userId, ticker, action, quantity, entry_price, signal_id, rationale } = req.body
    if (!userId || !ticker || !action) return res.status(400).json({ error: 'userId, ticker and action are required' })
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

app.post('/api/push/test', requireAuth, async (req, res) => {
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

app.get('/api/portfolio/intelligence', requireAuth, async (req, res) => {
  try {
    res.json(await getPortfolioIntelligence(req.userId))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const col = getCollection('notifications')
    if (!col) return res.status(500).json({ error: 'DB not connected' })
    const { ObjectId } = await import('mongodb')
    let q
    try { q = { _id: new ObjectId(req.params.id) } } catch { q = { _id: req.params.id } }
    await col.deleteOne(q)
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

app.post('/api/onboarding/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.userId
    const { risk, horizon, sectors, preferred_sectors, watchlist } = req.body
    const sectorList = parseOnboardingSectors({ sectors, preferred_sectors })
    info('onboarding', 'Onboarding started', { userId, risk, horizon, sectors: sectorList })

    const riskMap = { Conservative: 'conservative', Moderate: 'moderate', Aggressive: 'aggressive' }
    const horizonMap = { 'Short (< 1 year)': 'short', 'Medium (1-5 years)': 'medium', 'Long (5+ years)': 'long' }

    const usersCol = getCollection('users')
    if (usersCol) {
      const userUpdates = {}
      if (risk && riskMap[risk]) userUpdates.risk_tolerance = riskMap[risk]
      if (horizon && horizonMap[horizon]) userUpdates.investment_horizon = horizonMap[horizon]
      if (sectorList.length) userUpdates.preferred_sectors = sectorList
      userUpdates.onboarding_completed = true
      userUpdates.updated_at = new Date()
      const userUpdate = { $set: userUpdates }
      if (sectorList.length) userUpdate.$unset = { preferred_sector: '' }
      await usersCol.updateOne({ _id: userId }, userUpdate)
    }

    const riskProfiles = {
      conservative: { cash_reserve_pct: 20, stop_loss_pct: 8, take_profit_pct: 20, max_position_size_pct: 15, max_stocks: 10, trailing_stop_pct: 8 },
      moderate:     { cash_reserve_pct: 10, stop_loss_pct: 12, take_profit_pct: 25, max_position_size_pct: 20, max_stocks: 15, trailing_stop_pct: 10 },
      aggressive:   { cash_reserve_pct: 5, stop_loss_pct: 15, take_profit_pct: 35, max_position_size_pct: 25, max_stocks: 20, trailing_stop_pct: 12 },
    }
    const prefUpdates = { mode: 'agentic' }
    const riskKey = risk && riskMap[risk] ? riskMap[risk] : 'moderate'
    if (risk && riskMap[risk]) prefUpdates.risk_tolerance = riskMap[risk]
    if (horizon && horizonMap[horizon]) prefUpdates.investment_horizon = horizonMap[horizon]
    if (sectorList.length) prefUpdates.preferred_sectors = sectorList

    Object.assign(prefUpdates, riskProfiles[riskKey] || riskProfiles.moderate)
    await updatePreferences(userId, prefUpdates)

    let watchlistResult = null
    if (watchlist && watchlist !== 'Skipped' && watchlist.length > 0) {
      const wl = await createWatchlist({ userId, name: 'My Watchlist' })
      const tickers = typeof watchlist === 'string' ? watchlist.split(',').map(t => t.trim()).filter(Boolean) : watchlist
      for (const ticker of tickers) {
        const meta = await getTickerMetadata(ticker)
        const sector = resolveSector(ticker, meta.sector, null)
        await addWatchlistItem({ watchlistId: wl._id, ticker, sector, name: meta.name })
      }
      watchlistResult = { id: wl._id, name: wl.name, tickers }
    }

    info('onboarding', 'Onboarding complete', { userId, watchlistTickers: watchlistResult?.tickers?.length || 0 })
    res.json({ ok: true, watchlist: watchlistResult })
  } catch (err) {
    logError('onboarding', 'Onboarding failed', { userId: req.userId, error: err.message })
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/stocks/search', requireAuth, async (req, res) => {
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

app.post('/agent/chat', async (req, res) => {
  try {
    const { userId, message } = req.body
    if (!userId || !message) return res.status(400).json({ error: 'userId and message are required' })
    info('agent', 'Chat request', { userId, message: message.slice(0, 80) })
    const contextMessage = `[User: ${userId}] ${message}`
    const result = await runAgent(userId, contextMessage)
    info('agent', 'Chat response generated', { userId, toolCalls: result.toolCalls?.length || 0 })
    res.json(result)
  } catch (err) {
    logError('agent', 'Chat failed', { error: err.message })
    res.status(500).json({ error: err.message })
  }
})

app.post('/agent/scan', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    info('agent', 'Manual scan triggered', { userId })
    const result = await triggerManualScan(userId)
    info('agent', 'Manual scan complete', { userId, recommendations: result.recommendations?.length || 0 })
    res.json(result)
  } catch (err) {
    if (err.code === 'SCAN_LOCKED') return res.status(429).json({ error: err.message })
    logError('agent', 'Scan failed', { error: err.message })
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/activity', async (req, res) => {
  try {
    const { userId, limit } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const cap = limit ? Number(limit) * 3 : 60
    const notifications = await getNotifications(userId, { limit: cap })
    const meaningful = notifications.filter(n => {
      if (n.type === 'scan_complete') return false
      if (n.type === 'recommendation') {
        const t = (n.title || '').toUpperCase()
        return t.startsWith('BUY ') || t.startsWith('EXIT ') || t.startsWith('SELL ')
      }
      return ['trade_executed', 'auto_executed', 'rebalancing'].includes(n.type)
    })
    res.json(meaningful.slice(0, limit ? Number(limit) : 20))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/debug/api-usage', async (req, res) => {
  try {
    const hours = req.query.hours ? Number(req.query.hours) : 24
    res.json(await getApiUsageSummary(hours))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const recCol = getCollection('recommendation_log')
    const [summary, stats, pendingCount, prefs, latestRec, pendingRecs, blockedRecs] = await Promise.all([
      getPortfolioSummary(userId),
      getTradeStats(userId),
      getRecommendationsByStatus(userId, 'generated', 999).then(r => r.length),
      getPreferences(userId),
      getRecommendationsByStatus(userId, null, 1).then(r => r[0] || null),
      recCol ? recCol.find({ userId, status: 'generated' }).toArray() : [],
      recCol ? recCol.find({ userId, status: 'blocked' }).toArray() : [],
    ])
    const awaiting_execution = pendingRecs.filter(r => r.signal === 'BUY' || r.signal === 'EXIT').length
    const monitoring = pendingRecs.length - awaiting_execution

    res.json({
      virtual_cash: summary.virtual_cash,
      positions_value: summary.positions_value,
      starting_capital: stats.starting_capital,
      equity: summary.total_equity,
      portfolio_return_pct: summary.portfolio_return_pct,
      realized_pnl: stats.total_pnl,
      unrealized_pnl: summary.unrealized_pnl,
      open_positions: summary.position_count,
      open_trades: stats.open_trades,
      win_rate: stats.win_rate,
      total_trades: stats.total_trades,
      pending_actions: pendingCount,
      recommendation_queue: {
        awaiting_execution,
        monitoring,
        blocked: blockedRecs.length,
      },
      mode: prefs?.mode || 'agentic',
      next_scan: getNextScanTime(prefs?.signal_frequency || 'daily').toISOString(),
      latest_recommendation: latestRec ? { ticker: latestRec.ticker, signal: latestRec.signal, confidence: latestRec.confidence, confidence_delta: latestRec.confidence_delta, created_at: latestRec.created_at } : null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/agent/run', async (req, res) => {
  let lockedUserId = null
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId is required' })

    const lock = await acquireScanLock(userId)
    if (!lock.acquired) {
      if (lock.reason === 'not_found') return res.status(404).json({ error: 'User not found' })
      if (lock.reason === 'locked') {
        const elapsed = Date.now() - new Date(lock.started_at || Date.now()).getTime()
        return res.status(429).json({ error: 'Scan already in progress', started_at: lock.started_at, elapsed_ms: elapsed })
      }
      return res.status(500).json({ error: 'Could not acquire scan lock' })
    }
    lockedUserId = userId
    const lockStartedAt = lock.started_at

    const prefs = await getPreferences(userId)

    const mode = prefs?.mode === 'manual' ? 'manual' : 'agentic'

    info('agent', 'Full agent run started', { userId, mode })

    const prompt = `Analyze the full portfolio for user ${userId}. For every ticker in the portfolio and watchlist:
1. Get the latest price
2. Get price context (technicals)
3. Get market news
4. Generate and SAVE a recommendation for each ticker

After saving all recommendations, provide a brief portfolio summary with your key findings.`

    const result = await runAgent(userId, prompt)

    if (mode === 'agentic') {
      const exec = await runAutonomousExecution(userId, prefs)
      result.mode = 'agentic'
      result.auto_executed = exec.executed
      result.exits = exec.exits
      result.rebalance_signals = exec.rebalanceSignals
      info('agent', 'Agentic run complete', { userId, autoExecuted: exec.executed, exits: exec.exits, rebalanceSignals: exec.rebalanceSignals })
    } else {
      result.mode = 'manual'
      result.auto_executed = 0
      info('agent', 'Manual mode run complete', { userId })
    }

    const scanDuration = Date.now() - new Date(lockStartedAt || Date.now()).getTime()
    await getCollection('scan_history')?.updateOne(
      { userId, completed_at: { $gte: new Date(Date.now() - 60000) } },
      { $set: { userId, completed_at: new Date(), mode: result.mode, auto_executed: result.auto_executed || 0, duration_ms: scanDuration, recommendations_generated: result.toolCalls?.length || 0 } },
      { upsert: true }
    )
    info('agent', 'Scan duration', { userId, duration_ms: scanDuration })

    await releaseScanLock(userId)
    lockedUserId = null
    res.json(result)
  } catch (err) {
    if (lockedUserId) await releaseScanLock(lockedUserId)
    logError('agent', 'Agent run failed', { error: err.message })
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/portfolio/history', async (req, res) => {
  try {
    const { userId, days } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const snapshots = await getPortfolioSnapshots(userId, days ? Number(days) : 30)
    res.json(snapshots)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/learning/calibration', async (req, res) => {
  try {
    const { userId } = req.query
    const calibration = await getConfidenceCalibration(userId || null)
    res.json(calibration)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/learning/performance', async (req, res) => {
  try {
    const { userId } = req.query
    const performance = await getSignalPerformance(userId || null)
    res.json(performance)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/briefing/daily', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })
    const briefing = await generateDailyBriefing(userId)
    if (!briefing) return res.status(404).json({ error: 'No data for briefing' })
    res.json(briefing)
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

app.post('/api/learning/evaluate', async (req, res) => {
  try {
    const result = await evaluateRecommendationOutcomes()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/maintenance/nightly', async (req, res) => {
  try {
    await runNightlyJobs()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/agent/status', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId is required' })

    const prefs = await getPreferences(userId)
    const user = await getCollection('users')?.findOne({ _id: userId })

    const lastScan = await getCollection('scan_history')?.findOne({ userId }, { sort: { completed_at: -1 } })

    const recentRecs = await getCollection('recommendation_log')?.find({
      userId, created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).toArray() || []

    const signalBreakdown = { BUY: 0, HOLD: 0, EXIT: 0, WATCH: 0, REBALANCE: 0 }
    for (const r of recentRecs) signalBreakdown[r.signal] = (signalBreakdown[r.signal] || 0) + 1

    const recentTrades = await getCollection('virtual_trades')?.find({
      userId, created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).toArray() || []

    const pendingRecs = await getCollection('recommendation_log')?.find({ userId, status: 'generated' }).toArray() || []
    const blockedRecs = await getCollection('recommendation_log')?.find({ userId, status: 'blocked' }).toArray() || []
    const awaiting_execution = pendingRecs.filter(r => r.signal === 'BUY' || r.signal === 'EXIT').length
    const monitoring = pendingRecs.length - awaiting_execution
    const outcomes_24h = {
      executed: recentRecs.filter(r => r.status === 'executed').length,
      blocked: recentRecs.filter(r => r.status === 'blocked').length,
      monitoring: recentRecs.filter(r => r.status === 'generated' && r.signal !== 'BUY' && r.signal !== 'EXIT').length,
      awaiting_execution: recentRecs.filter(r => r.status === 'generated' && (r.signal === 'BUY' || r.signal === 'EXIT')).length,
    }

    const positions = await getCollection('portfolio_positions')?.find({ userId }).toArray() || []
    const scanTickers = await getScanTickers(userId)
    const market_data = await getMarketDataFreshness(scanTickers)

    res.json({
      mode: prefs?.mode || 'agentic',
      enabled: prefs?.enabled !== false,
      scan_in_progress: user?.scan_in_progress || false,
      market_data,
      last_scan: lastScan ? {
        completed_at: lastScan.completed_at,
        auto_executed: lastScan.auto_executed,
        mode: lastScan.mode,
        duration_ms: lastScan.duration_ms || null,
        tickers_scanned: lastScan.tickers_scanned ?? null,
        recommendations: lastScan.recommendations ?? lastScan.recommendations_generated ?? null,
        executed: lastScan.executed ?? lastScan.auto_executed ?? null,
      } : null,
      last_24h: {
        recommendations: recentRecs.length,
        signals: signalBreakdown,
        trades_executed: recentTrades.length,
        buys: recentTrades.filter(t => t.action === 'BUY').length,
        sells: recentTrades.filter(t => t.action === 'SELL').length,
        outcomes: outcomes_24h,
      },
      pending_recommendations: pendingRecs.length,
      recommendation_queue: {
        awaiting_execution,
        monitoring,
        blocked: blockedRecs.length,
      },
      portfolio: {
        positions: positions.length,
        max_stocks: prefs?.max_stocks || 15,
        cash_reserve_pct: prefs?.cash_reserve_pct || 10,
        stop_loss_pct: prefs?.stop_loss_pct || 12,
        take_profit_pct: prefs?.take_profit_pct || 25,
        trailing_stop_pct: prefs?.trailing_stop_pct || 10,
      },
      config: {
        risk_tolerance: prefs?.risk_tolerance || 'moderate',
        signal_frequency: prefs?.signal_frequency || 'hourly',
        min_confidence: prefs?.min_confidence || 0.7,
        max_position_size_pct: prefs?.max_position_size_pct || 20,
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function start() {
  try {
    await connect(process.env.MONGODB_URI)
    info('startup', 'MongoDB connected')
  } catch (err) {
    warn('startup', 'MongoDB connect failed', { error: err.message })
  }
  app.listen(port, () => info('startup', `Server listening on port ${port}`))
  if (process.env.TWELVEDATA_API_KEY) {
    startWebSocket()
    info('startup', 'WebSocket started')
  } else {
    warn('startup', 'TWELVEDATA_API_KEY not set - WebSocket disabled')
  }
  initPush()
  startScheduler()
  info('startup', 'All services initialized')
}

process.on('SIGTERM', () => { info('shutdown', 'SIGTERM received'); stopWebSocket(); process.exit(0) })
process.on('SIGINT',  () => { info('shutdown', 'SIGINT received'); stopWebSocket(); process.exit(0) })
start()
