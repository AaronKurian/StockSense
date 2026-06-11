
import { getCollection } from '../config/db.js'
import { info } from '../lib/logger.js'
import { resolveLatestPrice } from './prices.js'

function truncateToHour(d = new Date()) {
  const bucket = new Date(d)
  bucket.setMinutes(0, 0, 0)
  return bucket
}

async function computeEquityMetrics(userId) {
  const userCol = getCollection('users')
  const posCol = getCollection('portfolio_positions')
  if (!userCol || !posCol) return null

  const user = await userCol.findOne({ _id: userId })
  if (!user) return null

  const positions = await posCol.find({ userId }).toArray()
  const latestCol = getCollection('latest_prices')
  let positionValue = 0
  for (const p of positions) {
    let price = Number(p.average_price)
    if (latestCol) {
      const cached = await latestCol.findOne({ ticker: p.ticker })
      if (cached?.price) price = Number(cached.price)
    }
    positionValue += Number(p.quantity) * price
  }

  const cash = user.virtual_cash || 0
  const equity = cash + positionValue
  return {
    cash,
    equity,
    positionValue,
    positionCount: positions.length,
    startingCapital: user.starting_capital ?? 100000,
    createdAt: user.created_at,
  }
}

export async function saveEquitySnapshot(userId) {
  const metrics = await computeEquityMetrics(userId)
  if (!metrics) return null

  const { cash, equity, positionValue, positionCount } = metrics
  const bucket = truncateToHour()
  const hourCol = getCollection('portfolio_equity_history')
  if (!hourCol) return null

  const doc = {
    userId,
    bucket,
    portfolio_value: Number(equity.toFixed(2)),
    cash: Number(cash.toFixed(2)),
    positions_value: Number(positionValue.toFixed(2)),
    position_count: positionCount,
    granularity: 'hourly',
    updated_at: new Date(),
  }

  await hourCol.updateOne({ userId, bucket }, { $set: doc, $setOnInsert: { created_at: new Date() } }, { upsert: true })
  return doc
}

export async function savePortfolioSnapshot(userId) {
  const metrics = await computeEquityMetrics(userId)
  if (!metrics) return null

  const { cash, equity, positionValue, positionCount } = metrics
  await saveEquitySnapshot(userId).catch(() => {})

  const snapCol = getCollection('portfolio_snapshots')
  if (!snapCol) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const doc = {
    userId,
    date: today,
    portfolio_value: Number(equity.toFixed(2)),
    cash: Number(cash.toFixed(2)),
    positions_value: Number(positionValue.toFixed(2)),
    position_count: positionCount,
    integrity_check: Math.abs(equity - (cash + positionValue)) < 0.01,
    granularity: 'daily',
    created_at: new Date(),
  }

  if (!doc.integrity_check) {
    info('snapshots', `Integrity warning for ${userId}: equity=$${equity.toFixed(2)} != cash($${cash.toFixed(2)}) + positions($${positionValue.toFixed(2)})`)
  }

  await snapCol.updateOne({ userId, date: today }, { $set: doc }, { upsert: true })
  return doc
}

function withSyntheticBaseline(snaps, user) {
  if (!user || !snaps.length) return snaps
  const startCap = user.starting_capital ?? 100000
  const startDate = new Date(user.created_at || Date.now() - 7 * 86400000)
  startDate.setMinutes(0, 0, 0)
  const hasBaseline = snaps.some(s =>
    s.synthetic || (Number(s.position_count) === 0 && Math.abs(Number(s.portfolio_value) - startCap) < 1)
  )
  if (hasBaseline) return snaps
  return [{
    userId: user._id,
    date: startDate,
    portfolio_value: startCap,
    cash: startCap,
    positions_value: 0,
    position_count: 0,
    granularity: 'hourly',
    synthetic: true,
  }, ...snaps.filter(s => !s.synthetic)]
}

export async function getPortfolioSnapshots(userId, days = 30) {
  try { await savePortfolioSnapshot(userId) } catch {}

  const userCol = getCollection('users')
  const user = userCol ? await userCol.findOne({ _id: userId }) : null
  const hourCol = getCollection('portfolio_equity_history')
  const dayCol = getCollection('portfolio_snapshots')
  if (!hourCol || !dayCol) return []

  const accountAgeDays = user?.created_at
    ? (Date.now() - new Date(user.created_at).getTime()) / 86400000
    : 7
  const useHourly = days <= 7 || accountAgeDays <= 7

  if (useHourly) {
    const since = new Date(Date.now() - Math.min(days, 7) * 86400000)
    const hourly = await hourCol.find({ userId, bucket: { $gte: since } }).sort({ bucket: 1 }).toArray()
    const snaps = hourly.map(h => ({
      userId: h.userId,
      date: h.bucket,
      portfolio_value: h.portfolio_value,
      cash: h.cash,
      positions_value: h.positions_value,
      position_count: h.position_count,
      granularity: 'hourly',
    }))
    return withSyntheticBaseline(snaps, user)
  }

  const hourlySince = new Date(Date.now() - 7 * 86400000)
  const dailySince = new Date()
  dailySince.setDate(dailySince.getDate() - days)

  const [hourly, daily] = await Promise.all([
    hourCol.find({ userId, bucket: { $gte: hourlySince } }).sort({ bucket: 1 }).toArray(),
    dayCol.find({ userId, date: { $gte: dailySince, $lt: hourlySince } }).sort({ date: 1 }).toArray(),
  ])

  const snaps = [
    ...daily.map(d => ({
      userId: d.userId,
      date: d.date,
      portfolio_value: d.portfolio_value,
      cash: d.cash,
      positions_value: d.positions_value,
      position_count: d.position_count,
      granularity: 'daily',
    })),
    ...hourly.map(h => ({
      userId: h.userId,
      date: h.bucket,
      portfolio_value: h.portfolio_value,
      cash: h.cash,
      positions_value: h.positions_value,
      position_count: h.position_count,
      granularity: 'hourly',
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date))

  return withSyntheticBaseline(snaps, user)
}

export async function evaluateRecommendationOutcomes() {
  const recCol = getCollection('recommendation_log')
  const outcomeCol = getCollection('recommendation_outcomes')
  if (!recCol || !outcomeCol) return { evaluated: 0 }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const recsFor7d = await recCol.find({
    status: 'executed',
    executed_at: { $lte: sevenDaysAgo },
  }).toArray()

  let evaluated = 0
  for (const rec of recsFor7d) {
    const existingOutcome = await outcomeCol.findOne({ recommendationId: rec._id.toString(), period: '7d' })
    if (existingOutcome) continue

    try {

      const latestCol = getCollection('latest_prices')
      let currentPrice = null
      if (latestCol) {
        const cached = await latestCol.findOne({ ticker: rec.ticker })
        if (cached?.price) currentPrice = cached.price
      }
      if (!currentPrice) {
        const resolved = await resolveLatestPrice(rec.ticker, { source: 'learning_outcome' })
        if (!resolved.ok) continue
        currentPrice = resolved.price
      }

      const tradeCol = getCollection('virtual_trades')
      const trade = tradeCol ? await tradeCol.findOne({ signal_id: rec._id.toString() }) : null
      if (!trade?.entry_price) continue

      const actualEntry = trade.entry_price
      const returnPct = ((currentPrice - actualEntry) / actualEntry) * 100

      const successful = rec.signal === 'BUY' ? returnPct > 0 : rec.signal === 'EXIT' ? returnPct < 0 : null

      await outcomeCol.updateOne(
        { recommendationId: rec._id.toString(), period: '7d' },
        { $set: {
          recommendationId: rec._id.toString(),
          userId: rec.userId,
          ticker: rec.ticker,
          signal: rec.signal,
          confidence: rec.confidence,
          sector: rec.sector || null,
          entry_price: actualEntry,
          price_after: currentPrice,
          return_pct: Number(returnPct.toFixed(3)),
          successful,
          period: '7d',
          evaluated_at: new Date(),
          rec_created_at: rec.created_at,
        }},
        { upsert: true }
      )
      evaluated++
    } catch (err) {

    }
  }

  const recsFor30d = await recCol.find({
    status: 'executed',
    executed_at: { $lte: thirtyDaysAgo },
  }).toArray()

  for (const rec of recsFor30d) {
    const existingOutcome = await outcomeCol.findOne({ recommendationId: rec._id.toString(), period: '30d' })
    if (existingOutcome) continue

    try {

      const latestCol = getCollection('latest_prices')
      let currentPrice = null
      if (latestCol) {
        const cached = await latestCol.findOne({ ticker: rec.ticker })
        if (cached?.price) currentPrice = cached.price
      }
      if (!currentPrice) {
        const resolved = await resolveLatestPrice(rec.ticker, { source: 'learning_outcome' })
        if (!resolved.ok) continue
        currentPrice = resolved.price
      }

      const tradeCol = getCollection('virtual_trades')
      const trade = tradeCol ? await tradeCol.findOne({ signal_id: rec._id.toString() }) : null
      if (!trade?.entry_price) continue

      const actualEntry = trade.entry_price
      const returnPct = ((currentPrice - actualEntry) / actualEntry) * 100
      const successful = rec.signal === 'BUY' ? returnPct > 0 : rec.signal === 'EXIT' ? returnPct < 0 : null

      await outcomeCol.updateOne(
        { recommendationId: rec._id.toString(), period: '30d' },
        { $set: {
          recommendationId: rec._id.toString(),
          userId: rec.userId,
          ticker: rec.ticker,
          signal: rec.signal,
          confidence: rec.confidence,
          sector: rec.sector || null,
          entry_price: actualEntry,
          price_after: currentPrice,
          return_pct: Number(returnPct.toFixed(3)),
          successful,
          period: '30d',
          evaluated_at: new Date(),
          rec_created_at: rec.created_at,
        }},
        { upsert: true }
      )
      evaluated++
    } catch {}
  }

  if (evaluated > 0) info('learning', `Evaluated ${evaluated} recommendation outcome(s)`)
  return { evaluated }
}

export async function getConfidenceCalibration(userId) {
  const col = getCollection('recommendation_outcomes')
  if (!col) return []

  const query = userId ? { userId, period: '7d' } : { period: '7d' }
  const outcomes = await col.find(query).toArray()

  const ranges = [
    { label: '90-100%', min: 0.9, max: 1.0 },
    { label: '80-89%', min: 0.8, max: 0.9 },
    { label: '70-79%', min: 0.7, max: 0.8 },
    { label: '60-69%', min: 0.6, max: 0.7 },
    { label: '50-59%', min: 0.5, max: 0.6 },
  ]

  return ranges.map(range => {
    const inRange = outcomes.filter(o => o.confidence >= range.min && o.confidence < range.max)
    const successful = inRange.filter(o => o.successful === true).length
    const total = inRange.length
    return {
      range: range.label,
      total,
      successful,
      accuracy: total > 0 ? Number(((successful / total) * 100).toFixed(1)) : null,
      avg_return: total > 0 ? Number((inRange.reduce((s, o) => s + o.return_pct, 0) / total).toFixed(2)) : null,
    }
  })
}

export async function getSignalPerformance(userId) {
  const col = getCollection('recommendation_outcomes')
  if (!col) return {}

  const query = userId ? { userId, period: '7d' } : { period: '7d' }
  const outcomes = await col.find(query).toArray()

  const bySignal = {}
  for (const o of outcomes) {
    if (!bySignal[o.signal]) bySignal[o.signal] = { total: 0, successful: 0, returns: [] }
    bySignal[o.signal].total++
    if (o.successful) bySignal[o.signal].successful++
    bySignal[o.signal].returns.push(o.return_pct)
  }

  const result = {}
  for (const [signal, data] of Object.entries(bySignal)) {
    result[signal] = {
      total: data.total,
      success_rate: Number(((data.successful / data.total) * 100).toFixed(1)),
      avg_return: Number((data.returns.reduce((s, r) => s + r, 0) / data.returns.length).toFixed(2)),
      best: Number(Math.max(...data.returns).toFixed(2)),
      worst: Number(Math.min(...data.returns).toFixed(2)),
    }
  }
  return result
}

export async function generateDailyBriefing(userId) {
  const userCol = getCollection('users')
  const posCol = getCollection('portfolio_positions')
  const tradeCol = getCollection('virtual_trades')
  const snapCol = getCollection('portfolio_snapshots')
  if (!userCol || !posCol) return null

  const user = await userCol.findOne({ _id: userId })
  if (!user) return null

  const positions = await posCol.find({ userId }).toArray()
  const cash = user.virtual_cash || 0

  const latestCol = getCollection('latest_prices')
  let positionValue = 0
  for (const p of positions) {
    let price = Number(p.average_price)
    if (latestCol) {
      const cached = await latestCol.findOne({ ticker: p.ticker })
      if (cached?.price) price = Number(cached.price)
    }
    positionValue += Number(p.quantity) * price
  }

  const equity = cash + positionValue

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const prevSnap = snapCol ? await snapCol.findOne({ userId, date: { $lte: yesterday } }, { sort: { date: -1 } }) : null

  const dailyChange = prevSnap ? equity - prevSnap.portfolio_value : 0
  const dailyChangePct = prevSnap && prevSnap.portfolio_value > 0 ? (dailyChange / prevSnap.portfolio_value) * 100 : 0

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const rawTrades = tradeCol ? await tradeCol.find({ userId, created_at: { $gte: todayStart } }).sort({ created_at: 1 }).toArray() : []
  const seen = new Set()
  const todaysTrades = []
  for (const t of rawTrades) {
    const key = t.signal_id || `${t.action}:${t.ticker}:${t.quantity}:${t.entry_price}`
    if (seen.has(key)) continue
    seen.add(key)
    todaysTrades.push(t)
  }

  const positionsWithPnl = positions.map(p => {
    const pnlPct = Number(p.average_price) > 0 ? 0 : 0
    return { ticker: p.ticker, quantity: Number(p.quantity), avg: Number(p.average_price) }
  })

  return {
    userId,
    date: new Date().toISOString().split('T')[0],
    portfolio_value: Number(equity.toFixed(2)),
    cash: Number(cash.toFixed(2)),
    daily_change: Number(dailyChange.toFixed(2)),
    daily_change_pct: Number(dailyChangePct.toFixed(2)),
    positions: positions.length,
    todays_trades: todaysTrades.length,
    todays_buys: todaysTrades.filter(t => t.action === 'BUY').length,
    todays_sells: todaysTrades.filter(t => t.action === 'SELL').length,
    trade_details: todaysTrades.slice(0, 5).map(t => `${t.action} ${t.ticker} (${t.quantity} shares)`),
    total_return_pct: Number(((equity - (user.starting_capital || 100000)) / (user.starting_capital || 100000) * 100).toFixed(2)),
  }
}

export async function runNightlyJobs() {
  info('learning', 'Starting nightly jobs')

  const prefCol = getCollection('agent_preferences')
  const users = prefCol ? await prefCol.find({ enabled: true }).toArray() : []

  const { createNotification } = await import('./notifications.js')
  for (const u of users) {
    await savePortfolioSnapshot(u.userId).catch(() => {})

    try {
      const briefing = await generateDailyBriefing(u.userId)
      if (briefing) {
        const sign = briefing.daily_change >= 0 ? '+' : ''
        await createNotification({
          userId: u.userId, type: 'scan_complete',
          title: `Daily: Portfolio ${sign}${briefing.daily_change_pct.toFixed(2)}% ($${briefing.portfolio_value.toLocaleString()})`,
          message: briefing.todays_trades > 0 ? `${briefing.todays_trades} trade(s) today. ${briefing.trade_details?.join(', ') || ''}` : 'No trades today.',
        })
      }
    } catch {}
  }
  if (users.length) info('learning', `Saved ${users.length} snapshot(s) + briefings`)

  const { evaluated } = await evaluateRecommendationOutcomes()

  const notifCol = getCollection('notifications')
  if (notifCol) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const deleted = await notifCol.deleteMany({ created_at: { $lt: ninetyDaysAgo } })
    if (deleted.deletedCount > 0) info('learning', `Pruned ${deleted.deletedCount} old notification(s)`)
  }

  const scanCol = getCollection('scan_history')
  if (scanCol) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    await scanCol.deleteMany({ completed_at: { $lt: thirtyDaysAgo } })
  }

  const hourCol = getCollection('portfolio_equity_history')
  if (hourCol) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const pruned = await hourCol.deleteMany({ bucket: { $lt: ninetyDaysAgo } })
    if (pruned.deletedCount > 0) info('learning', `Pruned ${pruned.deletedCount} hourly equity snapshot(s) older than 90d`)
  }

  info('learning', `Nightly jobs complete. Outcomes evaluated: ${evaluated}`)
}
