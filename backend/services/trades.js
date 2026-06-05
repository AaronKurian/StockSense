import { getCollection } from '../config/db.js'

const VALID_ACTIONS = new Set(['BUY', 'SELL'])
const VALID_STATUSES = new Set(['open', 'closed', 'cancelled'])
const STARTING_CAPITAL = 100000

export async function getVirtualCash(userId) {
  const col = getCollection('users')
  if (!col) throw new Error('MongoDB not connected')
  const user = await col.findOne({ _id: userId })
  if (!user) throw new Error('User not found')
  if (user.virtual_cash == null) {
    await col.updateOne({ _id: userId }, { $set: { virtual_cash: STARTING_CAPITAL, starting_capital: STARTING_CAPITAL } })
    return { virtual_cash: STARTING_CAPITAL, starting_capital: STARTING_CAPITAL }
  }
  return { virtual_cash: user.virtual_cash, starting_capital: user.starting_capital || STARTING_CAPITAL }
}

export function calculatePositionSize({ virtual_cash, price, confidence, max_position_size_pct, risk_tolerance }) {
  const maxAllocation = virtual_cash * (max_position_size_pct / 100)
  const confidenceMultiplier = Math.min(1, confidence || 0.7)
  const riskMultiplier = risk_tolerance === 'aggressive' ? 1.0 : risk_tolerance === 'conservative' ? 0.5 : 0.75
  const allocation = maxAllocation * confidenceMultiplier * riskMultiplier
  const quantity = Math.floor(allocation / price)
  return { allocation: Number(allocation.toFixed(2)), quantity: Math.max(1, quantity), cost: Number((quantity * price).toFixed(2)) }
}

export async function validateExecution({ userId, ticker, action, confidence, price }) {
  const prefCol = getCollection('agent_preferences')
  const tradeCol = getCollection('virtual_trades')
  if (!prefCol || !tradeCol) throw new Error('MongoDB not connected')

  const prefs = await prefCol.findOne({ userId })
  const minConf = prefs?.min_confidence ?? 0.7
  const maxPosPct = prefs?.max_position_size_pct ?? 25

  if (confidence != null && confidence < minConf) {
    return { allowed: false, reason: `Confidence ${(confidence * 100).toFixed(0)}% below minimum ${(minConf * 100).toFixed(0)}%` }
  }

  if (action === 'BUY') {
    const { virtual_cash } = await getVirtualCash(userId)
    const sizing = calculatePositionSize({ virtual_cash, price: price || 1, confidence, max_position_size_pct: maxPosPct, risk_tolerance: prefs?.risk_tolerance || 'moderate' })
    if (sizing.cost > virtual_cash) {
      return { allowed: false, reason: `Insufficient cash: need $${sizing.cost.toFixed(0)} but have $${virtual_cash.toFixed(0)}` }
    }
  }

  const openTrades = await tradeCol.countDocuments({ userId, ticker: ticker?.toUpperCase(), status: 'open' })
  if (openTrades >= 3) {
    return { allowed: false, reason: `Already ${openTrades} open trades for ${ticker}` }
  }

  return { allowed: true, reason: null }
}

export async function createVirtualTrade({ userId, ticker, action, quantity, entry_price, signal_id = null, rationale = '' }) {
  const col = getCollection('virtual_trades')
  const userCol = getCollection('users')
  if (!col || !userCol) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  if (!ticker) throw new Error('ticker is required')
  if (!action || !VALID_ACTIONS.has(action)) throw new Error('action must be BUY or SELL')

  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('invalid quantity')
  const price = Number(entry_price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('invalid entry_price')

  const cost = Number((qty * price).toFixed(2))

  if (action === 'BUY') {
    const { virtual_cash } = await getVirtualCash(userId)
    if (cost > virtual_cash) throw new Error(`Insufficient cash: need $${cost} but have $${virtual_cash.toFixed(2)}`)
    await userCol.updateOne({ _id: userId }, { $inc: { virtual_cash: -cost } })
  }

  const doc = {
    userId, ticker: String(ticker).toUpperCase(), action, quantity: qty,
    entry_price: price, cost, exit_price: null, pnl: null, pnl_pct: null,
    status: 'open', signal_id: signal_id || null, rationale: rationale || '',
    created_at: new Date(), closed_at: null,
  }

  const res = await col.insertOne(doc)
  return { ...doc, _id: res.insertedId }
}

export async function closeVirtualTrade(tradeId, exit_price) {
  const col = getCollection('virtual_trades')
  const userCol = getCollection('users')
  if (!col || !userCol) throw new Error('MongoDB not connected')
  if (!tradeId) throw new Error('tradeId is required')

  const { ObjectId } = await import('mongodb')
  let q
  try { q = { _id: new ObjectId(tradeId) } } catch { q = { _id: tradeId } }

  const trade = await col.findOne(q)
  if (!trade) throw new Error('Trade not found')
  if (trade.status !== 'open') throw new Error('Trade is not open')

  const price = Number(exit_price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('invalid exit_price')

  const proceeds = Number((trade.quantity * price).toFixed(2))
  const pnl = trade.action === 'BUY'
    ? Number((proceeds - trade.cost).toFixed(2))
    : Number((trade.cost - proceeds).toFixed(2))
  const pnl_pct = Number(((pnl / trade.cost) * 100).toFixed(3))

  await userCol.updateOne({ _id: trade.userId }, { $inc: { virtual_cash: proceeds } })

  const res = await col.findOneAndUpdate(q, { $set: { exit_price: price, pnl, pnl_pct, status: 'closed', closed_at: new Date() } }, { returnDocument: 'after' })
  return res.value || res
}

export async function getVirtualTrades(userId, { status = null, ticker = null, limit = 50 } = {}) {
  const col = getCollection('virtual_trades')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const q = { userId }
  if (status && VALID_STATUSES.has(status)) q.status = status
  if (ticker) q.ticker = String(ticker).toUpperCase()
  return col.find(q).sort({ created_at: -1 }).limit(Number(limit)).toArray()
}

export async function getTradeStats(userId) {
  const col = getCollection('virtual_trades')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')

  const closed = await col.find({ userId, status: 'closed' }).toArray()
  const { virtual_cash, starting_capital } = await getVirtualCash(userId)
  const openCount = await col.countDocuments({ userId, status: 'open' })

  if (!closed.length) return { total_trades: 0, wins: 0, losses: 0, win_rate: 0, total_pnl: 0, avg_pnl_pct: 0, open_trades: openCount, virtual_cash, starting_capital }

  const wins = closed.filter(t => t.pnl > 0).length
  const losses = closed.filter(t => t.pnl <= 0).length
  const total_pnl = Number(closed.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2))
  const avg_pnl_pct = Number((closed.reduce((s, t) => s + (t.pnl_pct || 0), 0) / closed.length).toFixed(3))

  return { total_trades: closed.length, wins, losses, win_rate: Number((wins / closed.length * 100).toFixed(1)), total_pnl, avg_pnl_pct, open_trades: openCount, virtual_cash, starting_capital }
}
