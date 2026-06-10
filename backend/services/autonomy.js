
import { getCollection } from '../config/db.js'
import { get_latest_price, saveRecommendation, executeRecommendation, getRecommendationsByStatus } from './agent.js'
import { createVirtualTrade, validateExecution, calculatePositionSize, getVirtualCash, markToMarket } from './trades.js'
import { createNotification } from './notifications.js'
import { info, warn } from '../lib/logger.js'

const LOCK_TIMEOUT_MS = 15 * 60 * 1000

export async function acquireScanLock(userId) {
  const userCol = getCollection('users')
  if (!userCol) return { acquired: false, reason: 'db' }

  const staleCutoff = new Date(Date.now() - LOCK_TIMEOUT_MS)

  const user = await userCol.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { scan_in_progress: { $ne: true } },
        { scan_started_at: { $lt: staleCutoff } },
        { scan_started_at: { $exists: false } },
      ],
    },
    { $set: { scan_in_progress: true, scan_started_at: new Date() } },
    { returnDocument: 'after', includeResultMetadata: false }
  )

  if (!user) {
    const existing = await userCol.findOne({ _id: userId })
    if (!existing) return { acquired: false, reason: 'not_found' }
    return { acquired: false, reason: 'locked', started_at: existing.scan_started_at }
  }
  return { acquired: true, user, started_at: user.scan_started_at }
}

export async function releaseScanLock(userId) {
  const userCol = getCollection('users')
  await userCol?.updateOne({ _id: userId }, { $set: { scan_in_progress: false } }).catch(() => {})
}

export async function runAutonomousExecution(userId, prefs) {
  const executed = []
  let exits = 0
  let rebalanceSignals = 0

  const stopLossPct = prefs?.stop_loss_pct ?? 12
  const takeProfitPct = prefs?.take_profit_pct ?? 25
  const trailingStopPct = prefs?.trailing_stop_pct ?? 10
  const posCol = getCollection('portfolio_positions')
  const positions = posCol ? await posCol.find({ userId }).toArray() : []

  for (const pos of positions) {
    const priceDoc = await get_latest_price(pos.ticker)
    if (!priceDoc?.price) continue
    const currentPrice = priceDoc.price
    const avgPrice = Number(pos.average_price)
    const pnlPct = ((currentPrice - avgPrice) / avgPrice) * 100

    const highestSeen = Math.max(currentPrice, pos.highest_price_seen || currentPrice)
    if (highestSeen > (pos.highest_price_seen || 0)) {
      await posCol.updateOne({ userId, ticker: pos.ticker }, { $set: { highest_price_seen: highestSeen } })
    }

    let exitReason = null
    let sellQuantity = Number(pos.quantity)
    const drawdownPct = highestSeen > 0 ? ((highestSeen - currentPrice) / highestSeen) * 100 : 0

    if (drawdownPct >= trailingStopPct && pnlPct > 0) {
      exitReason = `Trailing stop triggered (${drawdownPct.toFixed(1)}% drawdown from peak $${highestSeen.toFixed(2)}, threshold ${trailingStopPct}%)`
    } else if (pnlPct <= -stopLossPct) {
      exitReason = `Stop-loss triggered (${pnlPct.toFixed(1)}% loss, threshold -${stopLossPct}%)`
    } else if (pnlPct >= takeProfitPct) {
      exitReason = `Take-profit triggered (+${pnlPct.toFixed(1)}% gain, threshold +${takeProfitPct}%)`
      sellQuantity = Math.ceil(Number(pos.quantity) * 0.5)
    }

    if (!exitReason) continue

    const existingExit = await getCollection('recommendation_log')?.findOne({
      userId, ticker: pos.ticker, signal: 'EXIT', status: 'generated',
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
    if (existingExit) continue

    const currentPos = await posCol.findOne({ userId, ticker: pos.ticker })
    const ownedQty = currentPos ? Math.floor(Number(currentPos.quantity)) : 0
    sellQuantity = Math.min(sellQuantity, ownedQty)
    if (sellQuantity <= 0) continue

    try {
      const savedRec = await saveRecommendation({ userId, ticker: pos.ticker, signal: 'EXIT', confidence: 0.9, rationale: exitReason, supporting_factors: [exitReason], risks: ['Market may reverse'] })
      const recId = savedRec?._id?.toString()
      if (recId) {
        const execd = await executeRecommendation(recId)
        await createVirtualTrade({ userId, ticker: pos.ticker, action: 'SELL', quantity: sellQuantity, entry_price: currentPrice, signal_id: recId, rationale: exitReason })
        await createNotification({ userId, type: 'auto_executed', title: `Auto Sell: ${pos.ticker} (${sellQuantity} shares @ $${currentPrice.toFixed(2)})`, message: exitReason, ticker: pos.ticker, recId })
        executed.push(execd)
        exits++
        info('autonomy', 'Auto exit', { userId, ticker: pos.ticker, reason: exitReason, pnlPct: pnlPct.toFixed(1), drawdownPct: drawdownPct.toFixed(1) })
      }
    } catch (err) {
      warn('autonomy', `Auto exit failed for ${pos.ticker}: ${err.message}`)
    }
  }

  const pending = await getRecommendationsByStatus(userId, 'generated', 20)
  for (const rec of pending) {
    if (rec.signal !== 'BUY' && rec.signal !== 'EXIT') continue
    const action = rec.signal === 'BUY' ? 'BUY' : 'SELL'
    const price_doc = await get_latest_price(rec.ticker)
    const price = price_doc?.price
    if (!price) continue

    const validation = await validateExecution({ userId, ticker: rec.ticker, action, confidence: rec.confidence, price })
    if (!validation.allowed) {
      info('autonomy', 'Execution skipped', { userId, ticker: rec.ticker, reason: validation.reason })
      continue
    }

    try {
      let quantity
      if (action === 'BUY') {
        const cashNow = (await getVirtualCash(userId)).virtual_cash
        const sizing = calculatePositionSize({ virtual_cash: cashNow, price, confidence: rec.confidence, max_position_size_pct: prefs?.max_position_size_pct || 20, risk_tolerance: prefs?.risk_tolerance || 'moderate', cash_reserve_pct: prefs?.cash_reserve_pct || 10 })
        quantity = sizing.quantity
      } else {
        const position = await getCollection('portfolio_positions')?.findOne({ userId, ticker: rec.ticker })
        quantity = position ? Math.floor(Number(position.quantity)) : 0
        if (quantity <= 0) continue
      }

      const execd = await executeRecommendation(rec._id.toString())
      await createVirtualTrade({ userId, ticker: rec.ticker, action, quantity, entry_price: price, signal_id: rec._id.toString(), rationale: rec.rationale })
      await createNotification({ userId, type: 'auto_executed', title: `Auto ${action === 'BUY' ? 'Buy' : 'Sell'}: ${rec.ticker} (${quantity} shares @ $${price.toFixed(2)})`, message: `Confidence ${Math.round((rec.confidence || 0) * 100)}%. ${rec.rationale?.slice(0, 80) || ''}`, ticker: rec.ticker, recId: rec._id.toString() })
      executed.push(execd)
      info('autonomy', 'Auto-executed trade', { userId, ticker: rec.ticker, action, quantity, price })
    } catch (err) {
      warn('autonomy', `Auto-exec failed for ${rec.ticker}: ${err.message}`)
    }
  }

  const maxSectorPct = prefs?.max_sector_exposure_pct ?? 40
  const marked = await markToMarket(userId)
  if (marked.positions.length >= 1 && marked.totalEquity > 0) {
    const sectorWeights = {}
    for (const p of marked.positions) {
      const sector = p.sector || 'Unknown'
      sectorWeights[sector] = (sectorWeights[sector] || 0) + (p.value / marked.totalEquity * 100)
    }
    for (const [sector, weight] of Object.entries(sectorWeights)) {
      if (weight > maxSectorPct && sector !== 'Unknown') {
        const largest = marked.positions
          .filter(p => (p.sector || 'Unknown') === sector)
          .sort((a, b) => b.value - a.value)[0]
        if (!largest) continue
        const existingTrim = await getCollection('recommendation_log')?.findOne({
          userId, ticker: largest.ticker, signal: 'EXIT', status: 'generated',
          created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        })
        if (existingTrim) continue
        const reason = `Rebalancing: ${sector} sector at ${weight.toFixed(0)}% (target <${maxSectorPct}%). Trimming largest position.`
        await saveRecommendation({ userId, ticker: largest.ticker, signal: 'EXIT', confidence: 0.75, rationale: reason, supporting_factors: [reason], risks: ['May miss further gains'] })
        await createNotification({ userId, type: 'rebalancing', title: `Rebalance: ${sector} overweight`, message: reason, ticker: largest.ticker })
        rebalanceSignals++
        info('autonomy', 'Rebalancing signal generated', { userId, ticker: largest.ticker, sector, weight: weight.toFixed(1) })
      }
    }
  }

  return { executed: executed.length, exits, rebalanceSignals }
}
