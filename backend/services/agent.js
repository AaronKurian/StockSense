import { getCollection } from '../config/db.js'
import { fetchTimeSeries, fetchQuote } from './twelvedata.js'
import { getLatestPricesBatch, upsertLatestPrice } from './prices.js'
import { createNotification } from './notifications.js'
import { subscribeToTickers } from './websocket.js'
import { info as logInfo, warn as logWarn } from '../lib/logger.js'
import { migrateSectorFields, parseAndValidateSectors, applySectorPreferenceBonus, mergePreferredSectors } from '../lib/sectors.js'
import { getPreferences } from './preferences.js'
import { getTickerMetadata } from './metadata.js'

const VALID_SIGNALS = new Set(['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE'])
const VALID_USER_ACTIONS = new Set(['confirmed', 'ignored', 'snoozed'])

const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'stocksense-13'
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
const VERTEX_MODEL = 'gemini-2.5-flash'
const VERTEX_ENDPOINT = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`

const TICKER_DELAY_MS = Number(process.env.AGENT_TICKER_DELAY_MS ?? 2000)
const GEMINI_MAX_RETRIES = Number(process.env.AGENT_GEMINI_MAX_RETRIES ?? 3)
const GEMINI_RETRY_BASE_MS = Number(process.env.AGENT_GEMINI_RETRY_BASE_MS ?? 5000)
const SIGNAL_CACHE_MINUTES = Number(process.env.AGENT_SIGNAL_CACHE_MINUTES ?? 30)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function isRateLimitError(err) {
  if (!err) return false
  if (err.status === 429 || err.code === 429) return true
  const m = String(err.message || '').toLowerCase()
  return m.includes('429') || m.includes('resource_exhausted') || m.includes('rate limit') || m.includes('quota')
}

function warn(msg) { logWarn('agent', msg) }

function normalizeTicker(ticker) {
  if (!ticker) throw new Error('ticker is required')
  return String(ticker).trim().toUpperCase()
}

function normalizeQuantity(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) throw new Error('invalid quantity')
  return n
}

function normalizePrice(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) throw new Error('invalid price')
  return n
}

async function resolveObjectId(id) {
  const { ObjectId } = await import('mongodb')
  try { return new ObjectId(id) } catch { return id }
}

export async function get_user_profile(userId) {
  const col = getCollection('users')
  if (!col) return null
  const user = await col.findOne({ _id: userId }) || null
  if (!user) return null
  const { sectors, migrated, hadLegacy } = migrateSectorFields(user)
  if (migrated || hadLegacy) {
    const update = { $set: { preferred_sectors: sectors, updated_at: new Date() } }
    if (hadLegacy) update.$unset = { preferred_sector: '' }
    await col.updateOne({ _id: userId }, update)
  }
  return { ...user, preferred_sectors: sectors }
}

export async function createUserProfile({ userId, email, name = null, risk_tolerance = 'moderate', investment_horizon = 'medium', preferred_sectors = [], experience_level = 'intermediate' }) {
  const col = getCollection('users')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  if (!email)  throw new Error('email is required')

  const RISK = new Set(['conservative', 'moderate', 'aggressive'])
  const HORIZON = new Set(['short', 'medium', 'long'])
  const EXP = new Set(['beginner', 'intermediate', 'expert'])
  if (!RISK.has(risk_tolerance)) throw new Error('invalid risk_tolerance')
  if (!HORIZON.has(investment_horizon)) throw new Error('invalid investment_horizon')
  if (!EXP.has(experience_level)) throw new Error('invalid experience_level')

  const doc = {
    _id: userId,
    email: String(email).trim().toLowerCase(),
    name: name ? String(name).trim() : null,
    risk_tolerance, investment_horizon, experience_level,
    preferred_sectors: Array.isArray(preferred_sectors) ? preferred_sectors.map(s => String(s).trim()).filter(Boolean) : [],
    created_at: new Date(), updated_at: new Date()
  }
  await col.updateOne({ _id: userId }, { $set: doc }, { upsert: true })
  return doc
}

export async function updateUserProfile(userId, updates = {}) {
  const col = getCollection('users')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')

  const RISK = new Set(['conservative', 'moderate', 'aggressive'])
  const HORIZON = new Set(['short', 'medium', 'long'])
  const EXP = new Set(['beginner', 'intermediate', 'expert'])
  const set = { updated_at: new Date() }

  if (updates.email != null) set.email = String(updates.email).trim().toLowerCase()
  if (updates.name != null) set.name = String(updates.name).trim()
  if (updates.risk_tolerance != null) {
    if (!RISK.has(updates.risk_tolerance)) throw new Error('invalid risk_tolerance')
    set.risk_tolerance = updates.risk_tolerance
  }
  if (updates.investment_horizon != null) {
    if (!HORIZON.has(updates.investment_horizon)) throw new Error('invalid investment_horizon')
    set.investment_horizon = updates.investment_horizon
  }
  if (updates.preferred_sector != null && updates.preferred_sectors == null) {
    updates.preferred_sectors = [updates.preferred_sector]
  }
  if (updates.preferred_sectors != null) {
    set.preferred_sectors = parseAndValidateSectors(updates.preferred_sectors, { allowEmpty: true })
  }
  if (updates.experience_level != null) {
    if (!EXP.has(updates.experience_level)) throw new Error('invalid experience_level')
    set.experience_level = updates.experience_level
  }
  if (Object.keys(set).length === 1) throw new Error('nothing to update')

  const res = await col.findOneAndUpdate({ _id: userId }, { $set: set }, { returnDocument: 'after' })
  return res.value
}

export async function get_watchlist(userId) {
  const col = getCollection('watchlists')
  if (!col) return null
  const docs = await col.find({ userId }).sort({ created_at: -1 }).toArray()
  if (!docs.length) return null
  const itemsCol = getCollection('watchlist_items')
  if (!itemsCol) return docs
  const ids = docs.map(d => d._id)
  return itemsCol.find({ watchlistId: { $in: ids } }).sort({ ticker: 1 }).toArray()
}

export async function getWatchlists(userId) {
  const col = getCollection('watchlists')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  return col.find({ userId }).sort({ created_at: -1 }).toArray()
}

export async function getWatchlistItems(watchlistId) {
  const col = getCollection('watchlist_items')
  if (!col) throw new Error('MongoDB not connected')
  if (!watchlistId) throw new Error('watchlistId is required')
  return col.find({ watchlistId: await resolveObjectId(watchlistId) }).sort({ ticker: 1 }).toArray()
}

export async function createWatchlist({ userId, name }) {
  const col = getCollection('watchlists')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  if (!name || !String(name).trim()) throw new Error('name is required')
  const doc = { userId, name: String(name).trim(), created_at: new Date() }
  const res = await col.insertOne(doc)
  return { ...doc, _id: res.insertedId }
}

export async function renameWatchlist({ userId, watchlistId, name }) {
  const col = getCollection('watchlists')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId || !watchlistId) throw new Error('userId and watchlistId required')
  if (!name || !String(name).trim()) throw new Error('name is required')
  const res = await col.findOneAndUpdate(
    { _id: await resolveObjectId(watchlistId), userId },
    { $set: { name: String(name).trim() } },
    { returnDocument: 'after' }
  )
  return res.value
}

export async function deleteWatchlist({ userId, watchlistId }) {
  const col = getCollection('watchlists')
  const itemsCol = getCollection('watchlist_items')
  if (!col || !itemsCol) throw new Error('MongoDB not connected')
  if (!userId || !watchlistId) throw new Error('userId and watchlistId required')
  const resolvedId = await resolveObjectId(watchlistId)
  const wl = await col.findOne({ _id: resolvedId, userId })
  if (!wl) return { deletedCount: 0, itemsDeletedCount: 0 }
  const itemsResult = await itemsCol.deleteMany({ watchlistId: resolvedId })
  const result = await col.deleteOne({ _id: resolvedId, userId })
  return { deletedCount: result.deletedCount, itemsDeletedCount: itemsResult.deletedCount }
}

export async function addWatchlistItem({ watchlistId, ticker, sector = null }) {
  const col = getCollection('watchlist_items')
  if (!col) throw new Error('MongoDB not connected')
  if (!watchlistId) throw new Error('watchlistId is required')
  const resolvedId = await resolveObjectId(watchlistId)
  const t = normalizeTicker(ticker)
  const doc = { watchlistId: resolvedId, ticker: t, sector: sector ? String(sector).trim() || null : null }
  const res = await col.updateOne({ watchlistId: resolvedId, ticker: t }, { $set: doc }, { upsert: true })

  try { subscribeToTickers([t]) } catch {}
  return { ...doc, upsertedId: res.upsertedId || null }
}

export async function removeWatchlistItem({ watchlistId, ticker }) {
  const col = getCollection('watchlist_items')
  if (!col) throw new Error('MongoDB not connected')
  if (!watchlistId) throw new Error('watchlistId is required')
  const result = await col.deleteOne({ watchlistId: await resolveObjectId(watchlistId), ticker: normalizeTicker(ticker) })
  return { deletedCount: result.deletedCount }
}

export async function get_portfolio(userId) {
  const col = getCollection('portfolio_positions')
  if (!col) return null
  return col.find({ userId }).sort({ ticker: 1 }).toArray()
}

export async function get_latest_price(ticker) {
  const col = getCollection('latest_prices')
  if (!col) return null
  const t = normalizeTicker(ticker)
  const cached = await col.findOne({ ticker: t })
  if (cached?.price != null) return cached

  try {
    logWarn('prices', `WebSocket price missing for ${t}, using REST fallback`)
    const quote = await fetchQuote(t)
    if (quote?.price) {
      const doc = await upsertLatestPrice(t, { price: quote.price, volume: quote.volume, change_percent: quote.change_percent })
      logInfo('prices', `Fetched fallback quote for ${t}: $${quote.price}`)
      return doc
    }
  } catch (err) {
    logWarn('prices', `REST fallback failed for ${t}: ${err.message}`)
  }
  return cached || null
}

export async function addPosition({ userId, ticker, quantity, average_price, sector = null }) {
  const col = getCollection('portfolio_positions')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const t = normalizeTicker(ticker)
  const doc = { userId, ticker: t, quantity: normalizeQuantity(quantity), average_price: normalizePrice(average_price), sector: sector ? String(sector).trim() || null : null, current_value: null }
  const res = await col.updateOne({ userId, ticker: t }, { $set: doc }, { upsert: true })
  return { ...doc, upsertedId: res.upsertedId || null }
}

export async function updatePosition({ userId, ticker, quantity, average_price, sector }) {
  const col = getCollection('portfolio_positions')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const t = normalizeTicker(ticker)
  const set = {}
  if (quantity != null) set.quantity = normalizeQuantity(quantity)
  if (average_price != null) set.average_price = normalizePrice(average_price)
  if (sector !== undefined) set.sector = sector ? String(sector).trim() || null : null
  if (!Object.keys(set).length) throw new Error('nothing to update')
  const res = await col.findOneAndUpdate({ userId, ticker: t }, { $set: set }, { returnDocument: 'after' })
  return res.value
}

export async function removePosition({ userId, ticker }) {
  const col = getCollection('portfolio_positions')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const res = await col.deleteOne({ userId, ticker: normalizeTicker(ticker) })
  return { deletedCount: res.deletedCount }
}

export async function getPortfolio(userId) {
  return get_portfolio(userId)
}

export async function calculatePortfolioValue(userId) {
  const positions = await get_portfolio(userId) || []
  const tickers = positions.map(p => p.ticker)
  const priceMap = await getLatestPricesBatch(tickers)
  let total = 0
  const details = positions.map(position => {
    const latest = priceMap.get(position.ticker)
    const price = latest && Number.isFinite(Number(latest.price)) ? Number(latest.price) : null
    const current_value = price != null ? Number((price * Number(position.quantity)).toFixed(6)) : null
    if (current_value != null) total += current_value
    return { ...position, current_value }
  })
  return { total_value: Number(total.toFixed(6)), positions: details }
}

export async function calculateSectorAllocation(userId) {
  const positions = await get_portfolio(userId) || []
  const tickers = positions.map(p => p.ticker)
  const priceMap = await getLatestPricesBatch(tickers)
  let total = 0
  const bySector = new Map()

  for (const position of positions) {
    const latest = priceMap.get(position.ticker)
    const price = latest && Number.isFinite(Number(latest.price)) ? Number(latest.price) : null
    const current_value = price != null ? Number((price * Number(position.quantity)).toFixed(6)) : null
    const sector = position.sector || latest?.sector || null
    if (sector && current_value != null) {
      bySector.set(sector, (bySector.get(sector) || 0) + current_value)
      total += current_value
    }
  }

  const allocation = []
  for (const [sector, value] of bySector.entries()) {
    allocation.push({ sector, value: Number(value.toFixed(6)), weight: total > 0 ? Number((value / total).toFixed(6)) : 0 })
  }
  allocation.sort((a, b) => b.value - a.value)
  return allocation
}

export async function saveRecommendation({ userId, ticker, signal, confidence = null, rationale = '', supporting_factors = [], risks = [], user_action = null }) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  if (!ticker) throw new Error('ticker is required')
  if (!signal || !VALID_SIGNALS.has(signal)) throw new Error('invalid signal')
  if (user_action != null && !VALID_USER_ACTIONS.has(user_action)) throw new Error('invalid user_action')

  const t = String(ticker).toUpperCase()
  let numericConf = confidence != null ? Number(confidence) : null
  if (numericConf != null && !Number.isFinite(numericConf)) throw new Error('invalid confidence')

  if (numericConf != null && numericConf > 1) numericConf = numericConf / 100

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const existing = await col.findOne({ userId, ticker: t, signal, status: 'generated', created_at: { $gte: twentyFourHoursAgo } })
  if (existing) return existing

  const prevRec = await col.find({ userId, ticker: t }).sort({ created_at: -1 }).limit(1).next()
  const prev_confidence = prevRec?.confidence ?? null
  const confidence_delta = (numericConf != null && prev_confidence != null) ? Number((numericConf - prev_confidence).toFixed(3)) : null

  const doc = {
    userId, ticker: t, signal,
    confidence: numericConf, prev_confidence, confidence_delta,
    rationale: rationale || '',
    supporting_factors: Array.isArray(supporting_factors) ? supporting_factors : [],
    risks: Array.isArray(risks) ? risks : [],
    status: 'generated',
    created_at: new Date(), user_action: user_action || null,
    approved_at: null, rejected_at: null, executed_at: null, expired_at: null
  }
  const res = await col.insertOne(doc)
  const saved = { ...doc, _id: res.insertedId }
  try {
    await createNotification({ userId, type: 'recommendation', title: `${signal} ${t}`, message: rationale?.slice(0, 120) || '', ticker: t, recId: res.insertedId.toString() })
  } catch {}
  return saved
}

export async function expireStaleRecommendations() {
  const col = getCollection('recommendation_log')
  if (!col) return 0
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const result = await col.updateMany(
    { status: 'generated', created_at: { $lt: fortyEightHoursAgo } },
    { $set: { status: 'expired', expired_at: new Date() } }
  )
  if (result.modifiedCount > 0) {
    logInfo('expire', `Expired ${result.modifiedCount} stale recommendation(s)`)
  }
  return result.modifiedCount
}

const VALID_REC_STATUSES = new Set(['generated', 'approved', 'rejected', 'executed', 'expired'])

export async function approveRecommendation(recId) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  const { ObjectId } = await import('mongodb')
  let q
  try { q = { _id: new ObjectId(recId) } } catch { q = { _id: recId } }
  const rec = await col.findOne(q)
  if (!rec) throw new Error('Recommendation not found')
  if (rec.status !== 'generated') throw new Error(`Cannot approve: status is ${rec.status}`)
  const res = await col.findOneAndUpdate(q, { $set: { status: 'approved', user_action: 'confirmed', approved_at: new Date() } }, { returnDocument: 'after' })
  return res.value || res
}

export async function rejectRecommendation(recId) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  const { ObjectId } = await import('mongodb')
  let q
  try { q = { _id: new ObjectId(recId) } } catch { q = { _id: recId } }
  const rec = await col.findOne(q)
  if (!rec) throw new Error('Recommendation not found')
  if (rec.status !== 'generated') throw new Error(`Cannot reject: status is ${rec.status}`)
  const res = await col.findOneAndUpdate(q, { $set: { status: 'rejected', user_action: 'ignored', rejected_at: new Date() } }, { returnDocument: 'after' })
  return res.value || res
}

export async function executeRecommendation(recId) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  const { ObjectId } = await import('mongodb')
  let q
  try { q = { _id: new ObjectId(recId) } } catch { q = { _id: recId } }
  const rec = await col.findOne(q)
  if (!rec) throw new Error('Recommendation not found')
  if (rec.status !== 'approved' && rec.status !== 'generated') throw new Error(`Cannot execute: status is ${rec.status}`)
  const res = await col.findOneAndUpdate(q, { $set: { status: 'executed', executed_at: new Date() } }, { returnDocument: 'after' })
  return res.value || res
}

export async function getRecommendationsByStatus(userId, status, limit = 50) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const q = { userId }
  if (status && VALID_REC_STATUSES.has(status)) q.status = status
  return col.find(q).sort({ created_at: -1 }).limit(Number(limit)).toArray()
}

export async function getRecommendationsForUser(userId, { limit = 50, since = null, signal = null } = {}) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const q = { userId }
  if (since) q.created_at = { $gte: new Date(since) }
  if (signal) q.signal = signal
  return col.find(q).sort({ created_at: -1 }).limit(Number(limit)).toArray()
}

export async function getLatestRecommendationForTicker(userId, ticker) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId || !ticker) throw new Error('userId and ticker required')
  return await col.find({ userId, ticker: String(ticker).toUpperCase() }).sort({ created_at: -1 }).limit(1).next() || null
}

export async function getLatestRecommendationsForTickers(userId, tickers) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  if (!tickers.length) return new Map()
  const pipeline = [
    { $match: { userId, ticker: { $in: tickers } } },
    { $sort: { created_at: -1 } },
    { $group: { _id: '$ticker', doc: { $first: '$$ROOT' } } }
  ]
  const results = await col.aggregate(pipeline).toArray()
  return new Map(results.map(r => [r._id, r.doc]))
}

export async function recordFeedback(recId, user_action) {
  const col = getCollection('recommendation_log')
  if (!col) throw new Error('MongoDB not connected')
  if (!recId) throw new Error('recId is required')
  if (user_action != null && !VALID_USER_ACTIONS.has(user_action)) throw new Error('invalid user_action')
  const q = { _id: await resolveObjectId(recId) }
  const res = await col.findOneAndUpdate(q, { $set: { user_action: user_action || null, user_action_at: new Date() } }, { returnDocument: 'after' })
  return res.value
}

export async function get_price_context(ticker) {
  if (!ticker) throw new Error('ticker required')
  let ts
  try {
    ts = await fetchTimeSeries(ticker, '1day', 250)
  } catch (err) {

    return null
  }
  if (!ts?.values?.length) return null

  const values = ts.values.map(v => ({ close: Number(v.close), volume: Number(v.volume || 0) }))
  const latest = values[0]
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
  const closeAt = (n) => values.length > n ? values[n].close : null

  const seven_close = closeAt(7)
  const thirty_close = closeAt(30)
  const seven_day_change_pct = seven_close ? ((latest.close - seven_close) / seven_close) * 100 : null
  const thirty_day_change_pct = thirty_close ? ((latest.close - thirty_close) / thirty_close) * 100 : null

  const dma = (n) => values.length >= n ? mean(values.slice(0, n).map(x => x.close)) : null
  const dma50 = dma(50)
  const dma200 = dma(200)

  let trend = 'neutral'
  if (seven_day_change_pct != null && thirty_day_change_pct != null) {
    if (seven_day_change_pct > 1 && thirty_day_change_pct > 1) trend = 'bullish'
    else if (seven_day_change_pct < -1 && thirty_day_change_pct < -1) trend = 'bearish'
  } else if (seven_day_change_pct != null) {
    trend = seven_day_change_pct > 1 ? 'bullish' : seven_day_change_pct < -1 ? 'bearish' : 'neutral'
  }

  let volume_spike = false
  if (values.length >= 5) {
    const recent = values.slice(1, 31).map(v => v.volume).filter(v => v > 0)
    if (recent.length >= 3 && mean(recent) > 0 && latest.volume > mean(recent) * 2) volume_spike = true
  }

  return {
    current_price: latest.close,
    seven_day_change_pct: seven_day_change_pct != null ? Number(seven_day_change_pct.toFixed(3)) : null,
    thirty_day_change_pct: thirty_day_change_pct != null ? Number(thirty_day_change_pct.toFixed(3)) : null,
    trend, above_50dma: dma50 != null ? latest.close > dma50 : null,
    above_200dma: dma200 != null ? latest.close > dma200 : null, volume_spike
  }
}

export async function get_market_news(ticker) {
  if (!ticker) throw new Error('ticker required')
  const t = String(ticker).trim().toUpperCase()
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(t)}&region=US&lang=en-US`
  let xml
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'StockSense/1.0' } })
    if (!resp.ok) return []
    xml = await resp.text()
  } catch { return [] }

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
  return items.slice(0, 5).map(item => {
    const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim()
    const pub = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || null
    return title ? { headline: title, published_at: pub } : null
  }).filter(Boolean)
}

function validateGeminiOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw new Error('Gemini returned invalid JSON')
  if (!VALID_SIGNALS.has(output.signal)) throw new Error('Gemini returned invalid signal')
  const confidence = Number(output.confidence)
  if (!Number.isFinite(confidence)) throw new Error('Gemini returned invalid confidence')
  const rationale = typeof output.rationale === 'string' ? output.rationale.trim() : ''
  if (!rationale) throw new Error('Gemini returned empty rationale')
  return {
    signal: output.signal, confidence, rationale,
    supporting_factors: Array.isArray(output.supporting_factors) ? output.supporting_factors.filter(f => typeof f === 'string' && f.trim()) : [],
    risks: Array.isArray(output.risks) ? output.risks.filter(r => typeof r === 'string' && r.trim()) : []
  }
}

import { GoogleAuth } from 'google-auth-library'

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })

async function getAccessToken() {
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Failed to obtain Vertex AI access token via ADC')
  return token
}

async function callGeminiOnce({ user_profile, portfolio, watchlist, latest_price, price_context, market_news } = {}) {
  const accessToken = await getAccessToken()

  const systemInstruction = 'You are StockSense, an investment reasoning engine. Return only strict JSON matching the schema. Do not include markdown, code fences, extra keys, or commentary. Use the supplied portfolio, watchlist, latest_price, price_context, and market_news to make one concise decision.'
  const context = JSON.stringify({ user_profile, portfolio, watchlist, latest_price, price_context, market_news } ?? null, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2)

  const response = await fetch(VERTEX_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: `Analyze the following context and return only the decision JSON.\nContext:\n${context}` }] }],
      generationConfig: {
        temperature: 0.2, topP: 0.95, maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          required: ['signal', 'confidence', 'rationale', 'supporting_factors', 'risks'],
          properties: {
            signal: { type: 'string', enum: ['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE'] },
            confidence: { type: 'number' }, rationale: { type: 'string' },
            supporting_factors: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } }
          }
        },
      }
    })
  })

  const payload = await response.json()
  if (!response.ok) {
    const errMsg = payload?.error?.message || payload?.error?.status || `Vertex AI HTTP ${response.status}`
    const err = new Error(errMsg)
    err.status = response.status
    throw err
  }
  const text = payload?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('')?.trim()
  if (!text) throw new Error('Vertex AI returned empty response')
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error('Vertex AI returned non-JSON output') }
  return validateGeminiOutput(parsed)
}

export async function callGemini(input = {}) {
  let lastErr
  for (let attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(input)
    } catch (err) {
      lastErr = err
      if (!isRateLimitError(err) || attempt === GEMINI_MAX_RETRIES) throw err
      const waitMs = GEMINI_RETRY_BASE_MS * Math.pow(3, attempt - 1)
      logWarn('agent', `Gemini rate-limited (attempt ${attempt}/${GEMINI_MAX_RETRIES}) — backing off ${Math.round(waitMs / 1000)}s`)
      await sleep(waitMs)
    }
  }
  throw lastErr
}

export async function generateSignal(ticker, { user_profile, portfolio, watchlist_items, latest_price, price_context, market_news }) {
  if (!ticker) throw new Error('ticker required')
  const result = await callGemini({ user_profile, portfolio, watchlist: watchlist_items, latest_price, price_context, market_news })
  return { ticker: String(ticker).toUpperCase(), ...result }
}

export async function getScanTickers(userId) {
  if (!userId) return []
  const [portfolio, watchlistItems] = await Promise.all([get_portfolio(userId), get_watchlist(userId)])
  const set = new Set()
  if (Array.isArray(portfolio)) for (const p of portfolio) if (p.ticker) set.add(p.ticker)
  if (Array.isArray(watchlistItems)) for (const w of watchlistItems) if (w.ticker) set.add(w.ticker)
  return [...set]
}

export async function runAgentForUser(userId) {
  if (!userId) throw new Error('userId required')

  const user_profile = await get_user_profile(userId)
  if (!user_profile) {
    logWarn('agent', `No user profile for ${userId} — user may not exist`)
    return []
  }
  const prefs = await getPreferences(userId)
  const preferredSectors = mergePreferredSectors(user_profile.preferred_sectors, prefs?.preferred_sectors)
  const portfolio = await get_portfolio(userId)
  const watchlistItems = await get_watchlist(userId)

  const tickerSet = new Set()
  if (Array.isArray(portfolio)) for (const p of portfolio) if (p.ticker) tickerSet.add(p.ticker)
  if (Array.isArray(watchlistItems)) for (const w of watchlistItems) if (w.ticker) tickerSet.add(w.ticker)
  if (!tickerSet.size) {
    logWarn('agent', `No tickers for ${userId} — portfolio: ${portfolio?.length || 0}, watchlist: ${watchlistItems?.length || 0}`)
    return []
  }

  const allTickers = [...tickerSet]

  const cacheCutoff = new Date(Date.now() - SIGNAL_CACHE_MINUTES * 60 * 1000)
  const recentRecs = SIGNAL_CACHE_MINUTES > 0 ? await getLatestRecommendationsForTickers(userId, allTickers) : new Map()
  const results = []
  const tickers = []
  for (const ticker of allTickers) {
    const recent = recentRecs.get(ticker)
    if (recent && recent.created_at && new Date(recent.created_at) >= cacheCutoff) {
      results.push({ ticker, cached: true })
      continue
    }
    tickers.push(ticker)
  }
  const cachedCount = allTickers.length - tickers.length
  logInfo('agent', `Scanning ${tickers.length} ticker(s) for ${userId}${cachedCount ? ` (${cachedCount} cached/skipped)` : ''}: ${tickers.join(', ') || '—'}`)
  if (!tickers.length) return results

  const contextResults = await Promise.allSettled(tickers.map(async (ticker) => {
    const [latest_price, price_context, market_news] = await Promise.allSettled([
      get_latest_price(ticker),
      get_price_context(ticker),
      get_market_news(ticker)
    ])
    return {
      ticker,
      latest_price: latest_price.status === 'fulfilled' ? latest_price.value : null,
      price_context: price_context.status === 'fulfilled' ? price_context.value : null,
      market_news: market_news.status === 'fulfilled' ? market_news.value : []
    }
  }))

  const fulfilled = contextResults.filter(s => s.status === 'fulfilled').map(s => s.value)
  for (let i = 0; i < fulfilled.length; i++) {
    const { ticker, latest_price, price_context, market_news } = fulfilled[i]

    let recommendation
    try {
      recommendation = await generateSignal(ticker, { user_profile, portfolio, watchlist_items: watchlistItems, latest_price, price_context, market_news })
      if (recommendation.confidence != null && preferredSectors.length) {
        const meta = await getTickerMetadata(ticker)
        recommendation.confidence = applySectorPreferenceBonus(
          recommendation.confidence,
          meta.sector,
          preferredSectors
        )
      }
    } catch (err) {
      warn(`generateSignal failed for ${ticker}: ${err.message}`)
      results.push({ ticker, error: err.message })
      if (i < fulfilled.length - 1 && TICKER_DELAY_MS > 0) await sleep(TICKER_DELAY_MS)
      continue
    }

    try {
      const saved = await saveRecommendation({ userId, ...recommendation })
      results.push(saved)
    } catch (err) {
      warn(`saveRecommendation failed for ${ticker}: ${err.message}`)
      results.push(recommendation)
    }

    if (i < fulfilled.length - 1 && TICKER_DELAY_MS > 0) await sleep(TICKER_DELAY_MS)
  }
  return results
}
