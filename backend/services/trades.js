import { getCollection } from '../config/db.js'
import { resolveSector } from '../lib/sectors.js'
import { getLatestPricesBatch, refreshQuotesBatch } from './prices.js'
import { getMetadataBatch, getTickerMetadata, repairUserSectors } from './metadata.js'
import { subscribeToTickers } from './websocket.js'
import { savePortfolioSnapshot } from './learning.js'

const VALID_ACTIONS = new Set(['BUY', 'SELL'])
const VALID_STATUSES = new Set(['open', 'closed', 'cancelled'])
const STARTING_CAPITAL = 100000

export async function markToMarket(userId) {
  const posCol = getCollection('portfolio_positions')
  const positions = posCol ? await posCol.find({ userId }).toArray() : []
  const { virtual_cash, starting_capital } = await getVirtualCash(userId)
  const priceMap = positions.length ? await getLatestPricesBatch(positions.map(p => p.ticker)) : new Map()
  const metaMap = positions.length ? await getMetadataBatch(positions.map(p => p.ticker)) : new Map()

  let positionsValue = 0
  const marked = positions.map(p => {
    const live = priceMap.get(p.ticker)?.price
    const mark = (live != null && Number.isFinite(Number(live)) && Number(live) > 0) ? Number(live) : Number(p.average_price)
    const value = Number((Number(p.quantity) * mark).toFixed(2))
    positionsValue += value
    const sector = resolveSector(p.ticker, metaMap.get(p.ticker)?.sector, p.sector)
    return { ...p, mark, value, sector }
  })

  positionsValue = Number(positionsValue.toFixed(2))
  return { cash: virtual_cash, starting_capital, positionsValue, totalEquity: Number((virtual_cash + positionsValue).toFixed(2)), positions: marked }
}

export async function getPortfolioSummary(userId) {
  try { await repairUserSectors(userId) } catch {}
  const posCol = getCollection('portfolio_positions')
  const held = posCol ? await posCol.find({ userId }, { projection: { ticker: 1 } }).toArray() : []
  if (held.length) {
    try { await refreshQuotesBatch(held.map(p => p.ticker), { source: 'portfolio' }) } catch {}
  }
  const marked = await markToMarket(userId)
  const costBasis = marked.positions.reduce((s, p) => s + Number(p.average_price) * Number(p.quantity), 0)
  const unrealized_pnl = Number((marked.positionsValue - costBasis).toFixed(2))
  const unrealized_pnl_pct = costBasis > 0 ? Number(((unrealized_pnl / costBasis) * 100).toFixed(2)) : 0
  const portfolio_return_pct = marked.starting_capital > 0
    ? Number(((marked.totalEquity - marked.starting_capital) / marked.starting_capital * 100).toFixed(2))
    : 0
  return {
    total_equity: marked.totalEquity,
    virtual_cash: marked.cash,
    positions_value: marked.positionsValue,
    cost_basis: Number(costBasis.toFixed(2)),
    unrealized_pnl,
    unrealized_pnl_pct,
    portfolio_return_pct,
    position_count: marked.positions.length,
    positions: marked.positions.map(p => ({
      ticker: p.ticker,
      quantity: p.quantity,
      average_price: p.average_price,
      mark: p.mark,
      value: p.value,
      unrealized_pnl: Number((p.value - Number(p.average_price) * Number(p.quantity)).toFixed(2)),
    })),
  }
}

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

export function calculatePositionSize({ virtual_cash, price, confidence, max_position_size_pct, risk_tolerance, cash_reserve_pct = 10 }) {

  const reserveAmount = virtual_cash * (cash_reserve_pct / 100)
  const availableCash = Math.max(0, virtual_cash - reserveAmount)

  const maxAllocation = availableCash * (max_position_size_pct / 100)
  const confidenceMultiplier = Math.min(1, confidence || 0.7)
  const riskMultiplier = risk_tolerance === 'aggressive' ? 1.0 : risk_tolerance === 'conservative' ? 0.5 : 0.75
  const allocation = maxAllocation * confidenceMultiplier * riskMultiplier
  const quantity = Math.floor(allocation / price)
  return { allocation: Number(allocation.toFixed(2)), quantity: Math.max(1, quantity), cost: Number((Math.max(1, quantity) * price).toFixed(2)), availableCash: Number(availableCash.toFixed(2)) }
}

export async function validateExecution({ userId, ticker, action, confidence, price }) {
  const prefCol = getCollection('agent_preferences')
  const tradeCol = getCollection('virtual_trades')
  const posCol = getCollection('portfolio_positions')
  if (!prefCol || !tradeCol) throw new Error('MongoDB not connected')

  const prefs = await prefCol.findOne({ userId })
  const minConf = prefs?.min_confidence ?? 0.7
  const maxPosPct = prefs?.max_position_size_pct ?? 20
  const cashReservePct = prefs?.cash_reserve_pct ?? 10
  const maxStocks = prefs?.max_stocks ?? 15

  if (confidence != null && confidence < minConf) {
    return { allowed: false, reason: `Confidence ${(confidence * 100).toFixed(0)}% below minimum ${(minConf * 100).toFixed(0)}%` }
  }

  if (action === 'BUY') {
    const { virtual_cash } = await getVirtualCash(userId)
    const reserveAmount = virtual_cash * (cashReservePct / 100)
    const availableCash = virtual_cash - reserveAmount

    const sizing = calculatePositionSize({ virtual_cash, price: price || 1, confidence, max_position_size_pct: maxPosPct, risk_tolerance: prefs?.risk_tolerance || 'moderate', cash_reserve_pct: cashReservePct })
    if (sizing.cost > availableCash) {
      return { allowed: false, reason: `Insufficient cash after ${cashReservePct}% reserve: need $${sizing.cost.toFixed(0)} but available $${availableCash.toFixed(0)}` }
    }

    if (posCol) {
      const marked = await markToMarket(userId)
      const positions = marked.positions

      const existingTicker = positions.find(p => p.ticker === ticker?.toUpperCase())
      if (!existingTicker && positions.length >= maxStocks) {
        return { allowed: false, reason: `Max ${maxStocks} positions reached` }
      }

      if (existingTicker && marked.totalEquity > 0) {
        const currentWeight = existingTicker.value / marked.totalEquity * 100
        if (currentWeight >= maxPosPct) {
          return { allowed: false, reason: `${ticker} already at ${currentWeight.toFixed(1)}% (max ${maxPosPct}%)` }
        }
      }
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
  const posCol = getCollection('portfolio_positions')
  if (!col || !userCol) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  if (!ticker) throw new Error('ticker is required')
  if (!action || !VALID_ACTIONS.has(action)) throw new Error('action must be BUY or SELL')

  if (signal_id) {
    const existing = await col.findOne({ userId, signal_id: String(signal_id) })
    if (existing) return existing
  }

  const qty = Number(quantity)
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('invalid quantity')
  const price = Number(entry_price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('invalid entry_price')

  const t = String(ticker).toUpperCase()
  const cost = Number((qty * price).toFixed(2))

  let sellRealized = false
  let sellPnl = null
  let sellPnlPct = null

  if (action === 'SELL' && posCol) {
    const pos = await posCol.findOne({ userId, ticker: t })
    const owned = pos ? Math.floor(Number(pos.quantity)) : 0
    if (qty > owned) {
      throw new Error(`Cannot sell ${qty} shares of ${t} - only own ${owned}`)
    }
  }

  if (action === 'BUY') {
    const { virtual_cash } = await getVirtualCash(userId)
    if (cost > virtual_cash) throw new Error(`Insufficient cash: need $${cost} but have $${virtual_cash.toFixed(2)}`)
    await userCol.updateOne({ _id: userId }, { $inc: { virtual_cash: -cost } })

    if (posCol) {
      const existing = await posCol.findOne({ userId, ticker: t })
      if (existing) {
        const oldQty = Number(existing.quantity)
        const oldAvg = Number(existing.average_price)
        const newQty = oldQty + qty
        const newAvg = Number(((oldAvg * oldQty + price * qty) / newQty).toFixed(4))
        const highestSeen = Math.max(price, existing.highest_price_seen || price)
        await posCol.updateOne({ userId, ticker: t }, { $set: { quantity: newQty, average_price: newAvg, highest_price_seen: highestSeen, updated_at: new Date() } })
      } else {
        const meta = await getTickerMetadata(t)
        const sector = resolveSector(t, meta.sector, null)
        await posCol.updateOne({ userId, ticker: t }, { $set: { userId, ticker: t, quantity: qty, average_price: price, highest_price_seen: price, sector, created_at: new Date(), updated_at: new Date() } }, { upsert: true })

        try { subscribeToTickers([t]) } catch {}
      }
      if (existing && (existing.sector == null || existing.sector === 'Unknown')) {
        const meta = await getTickerMetadata(t)
        const sector = resolveSector(t, meta.sector, existing.sector)
        if (sector !== 'Unknown') {
          await posCol.updateOne({ userId, ticker: t }, { $set: { sector, updated_at: new Date() } })
        }
      }
    }
  } else if (action === 'SELL') {

    await userCol.updateOne({ _id: userId }, { $inc: { virtual_cash: cost } })

    if (posCol) {
      const existing = await posCol.findOne({ userId, ticker: t })
      if (existing) {
        const avg = Number(existing.average_price)
        sellPnl = Number(((price - avg) * qty).toFixed(2))
        sellPnlPct = avg > 0 ? Number((((price - avg) / avg) * 100).toFixed(3)) : 0
        sellRealized = true
        const newQty = Number(existing.quantity) - qty
        if (newQty <= 0) {
          await posCol.deleteOne({ userId, ticker: t })
        } else {
          await posCol.updateOne({ userId, ticker: t }, { $set: { quantity: newQty, updated_at: new Date() } })
        }
      }
    }
  }

  const doc = {
    userId, ticker: t, action, quantity: qty,
    entry_price: price, cost,
    exit_price: sellRealized ? price : null,
    pnl: sellRealized ? sellPnl : null,
    pnl_pct: sellRealized ? sellPnlPct : null,
    status: sellRealized ? 'closed' : 'open',
    signal_id: signal_id || null, rationale: rationale || '',
    created_at: new Date(), closed_at: sellRealized ? new Date() : null,
  }

  const res = await col.insertOne(doc)
  try { await savePortfolioSnapshot(userId) } catch {}
  return { ...doc, _id: res.insertedId }
}

export async function closeVirtualTrade(tradeId, exit_price) {
  const col = getCollection('virtual_trades')
  const userCol = getCollection('users')
  const posCol = getCollection('portfolio_positions')
  if (!col || !userCol) throw new Error('MongoDB not connected')
  if (!tradeId) throw new Error('tradeId is required')

  const { ObjectId } = await import('mongodb')
  let q
  try { q = { _id: new ObjectId(tradeId) } } catch { q = { _id: tradeId } }

  const trade = await col.findOne(q)
  if (!trade) throw new Error('Trade not found')

  if (trade.action === 'SELL') {
    throw new Error('SELL trades are completed exits and cannot be closed')
  }

  if (trade.status !== 'open') throw new Error('Trade is not open')

  const price = Number(exit_price)
  if (!Number.isFinite(price) || price <= 0) throw new Error('invalid exit_price')

  const proceeds = Number((trade.quantity * price).toFixed(2))
  const pnl = Number((proceeds - trade.cost).toFixed(2))
  const pnl_pct = Number(((pnl / trade.cost) * 100).toFixed(3))

  await userCol.updateOne({ _id: trade.userId }, { $inc: { virtual_cash: proceeds } })

  if (posCol) {
    const existing = await posCol.findOne({ userId: trade.userId, ticker: trade.ticker })
    if (existing) {
      const newQty = Number(existing.quantity) - Number(trade.quantity)
      if (newQty <= 0) await posCol.deleteOne({ userId: trade.userId, ticker: trade.ticker })
      else await posCol.updateOne({ userId: trade.userId, ticker: trade.ticker }, { $set: { quantity: newQty, updated_at: new Date() } })
    }
  }

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
