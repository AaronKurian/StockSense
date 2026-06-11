import { getCollection } from '../config/db.js'
import { getLatestPricesBatch, refreshQuotesBatch } from './prices.js'
import { getMetadataBatch } from './metadata.js'
import { resolveSector } from '../lib/sectors.js'
import { getVirtualCash, getTradeStats } from './trades.js'

export async function getPortfolioIntelligence(userId) {
  if (!userId) throw new Error('userId required')
  return computeIntelligence(userId)
}

async function computeIntelligence(userId) {

  const positions = await getCollection('portfolio_positions')?.find({ userId }).toArray() || []
  const { virtual_cash, starting_capital } = await getVirtualCash(userId)

  if (!positions.length) {
    return {
      healthScore: 50,
      healthBreakdown: {
        score: 50,
        diversification: 0,
        concentration: 100,
        cashReserve: 100,
        sectorBalance: 100,
        factors: [{ type: 'info', text: 'No positions - portfolio is 100% cash' }],
      },
      sectors: [],
      concentration: { hasRisk: false, alerts: [], herfindahlIndex: 0 },
      allocation: { cashWeight: 1, equityWeight: 0, diversificationScore: 0, positionCount: 0 },
      performance: { totalReturn: 0, totalReturnPct: 0, winRate: 0, bestPerformer: null, bestPerformerPct: null, worstPerformer: null, worstPerformerPct: null },
      warnings: [{ type: 'info', message: 'No positions - portfolio is 100% cash', severity: 'low' }],
      insights: ['Your portfolio is empty. Add positions or let the agent generate BUY recommendations.']
    }
  }

  const tickers = positions.map(p => p.ticker)
  try { await refreshQuotesBatch(tickers, { source: 'intelligence' }) } catch {}
  const [priceMap, metaMap, tradeStats] = await Promise.all([
    getLatestPricesBatch(tickers),
    getMetadataBatch(tickers),
    getTradeStats(userId)
  ])

  let totalEquity = 0
  const positionValues = []
  for (const pos of positions) {
    const live = priceMap.get(pos.ticker)?.price
    const price = (live != null && Number.isFinite(Number(live)) && Number(live) > 0)
      ? Number(live)
      : Number(pos.average_price)
    const value = price * Number(pos.quantity)
    totalEquity += value
    const meta = metaMap.get(pos.ticker)
    const sector = resolveSector(pos.ticker, meta?.sector, pos.sector)
    const pnlPct = price ? ((price - Number(pos.average_price)) / Number(pos.average_price)) * 100 : 0
    positionValues.push({ ticker: pos.ticker, value, sector, pnlPct, quantity: pos.quantity, avgPrice: pos.average_price, currentPrice: price })
  }

  const totalValue = totalEquity + virtual_cash

  const sectorMap = new Map()
  for (const pv of positionValues) {
    const existing = sectorMap.get(pv.sector) || { value: 0, count: 0 }
    sectorMap.set(pv.sector, { value: existing.value + pv.value, count: existing.count + 1 })
  }
  const sectors = [...sectorMap.entries()].map(([sector, { value, count }]) => ({
    sector, value: Number(value.toFixed(2)), weight: Number((value / totalValue).toFixed(4)), positionCount: count
  })).sort((a, b) => b.value - a.value)

  const cashWeight = totalValue > 0 ? virtual_cash / totalValue : 1
  const equityWeight = 1 - cashWeight
  const portfolioMature = isPortfolioMature(positions.length, cashWeight)
  const concentration = detectConcentrationRisk(positionValues, totalEquity, portfolioMature)
  const diversificationScore = calcDiversificationScore(positions.length, concentration.herfindahlIndex)
  const allocation = { cashWeight: Number(cashWeight.toFixed(4)), equityWeight: Number(equityWeight.toFixed(4)), diversificationScore, positionCount: positions.length, portfolioMature }

  const sorted = [...positionValues].sort((a, b) => b.pnlPct - a.pnlPct)
  const performance = {
    totalReturn: Number((totalValue - starting_capital).toFixed(2)),
    totalReturnPct: Number(((totalValue - starting_capital) / starting_capital * 100).toFixed(2)),
    winRate: tradeStats.win_rate || 0,
    bestPerformer: sorted[0]?.ticker || null,
    bestPerformerPct: sorted[0] ? Number(sorted[0].pnlPct.toFixed(2)) : null,
    worstPerformer: sorted.length > 1 ? sorted[sorted.length - 1].ticker : null,
    worstPerformerPct: sorted.length > 1 ? Number(sorted[sorted.length - 1].pnlPct.toFixed(2)) : null,
  }

  const maxSectorWeight = sectors.length ? sectors[0].weight : 0
  const warnings = generateWarnings(sectors, positionValues, totalEquity, cashWeight, positions.length, portfolioMature)
  const insights = generateInsights(positionValues, sectors, cashWeight, performance, portfolioMature)
  const healthBreakdown = calculateHealthScore(allocation, concentration, cashWeight, maxSectorWeight, portfolioMature)

  return { healthScore: healthBreakdown.score, healthBreakdown, sectors, concentration, allocation, performance, warnings, insights }
}

function isPortfolioMature(positionCount, cashWeight) {
  const investedPct = (1 - cashWeight) * 100
  return positionCount >= 5 || investedPct >= 75
}

function detectConcentrationRisk(positions, totalEquity, portfolioMature = true) {
  if (!portfolioMature || totalEquity <= 0) return { hasRisk: false, alerts: [], herfindahlIndex: 0 }
  const alerts = []
  let hhi = 0
  for (const pos of positions) {
    const weight = pos.value / totalEquity
    hhi += weight * weight
    if (weight > 0.35) alerts.push({ ticker: pos.ticker, weight: Number(weight.toFixed(4)), level: 'critical' })
    else if (weight > 0.20) alerts.push({ ticker: pos.ticker, weight: Number(weight.toFixed(4)), level: 'warning' })
  }
  return { hasRisk: alerts.length > 0, alerts: alerts.sort((a, b) => b.weight - a.weight), herfindahlIndex: Number(hhi.toFixed(4)) }
}

function calcDiversificationScore(positionCount, hhi) {
  const countScore = Math.min(100, positionCount * 15)
  const hhiScore = Math.round((1 - hhi) * 100)
  return Math.round(countScore * 0.4 + hhiScore * 0.6)
}

function calculateHealthScore(allocation, concentration, cashWeight, maxSectorWeight, portfolioMature = true) {
  const divScore = allocation.diversificationScore
  const concScore = Math.round((1 - concentration.herfindahlIndex) * 100)
  let cashScore = 70
  const factors = []

  if (!portfolioMature) {
    factors.push({ type: 'info', text: 'Portfolio still being constructed - full scoring at 5+ positions or 75% invested' })
    return {
      score: 70,
      diversification: divScore,
      concentration: concScore,
      cashReserve: cashScore,
      sectorBalance: 100,
      factors,
    }
  }

  if (cashWeight >= 0.10 && cashWeight <= 0.30) {
    cashScore = 100
    factors.push({ type: 'positive', text: 'Cash reserves in target range (10–30%)' })
  } else if (cashWeight < 0.05) {
    cashScore = 30
    factors.push({ type: 'negative', text: 'Cash reserves critically low (<5%)' })
  } else if (cashWeight > 0.50) {
    cashScore = 50
    factors.push({ type: 'negative', text: `High cash position (${Math.round(cashWeight * 100)}%)` })
  }

  const sectorScore = maxSectorWeight > 0.50 ? 30 : maxSectorWeight > 0.35 ? 60 : 100
  if (maxSectorWeight > 0.50) {
    factors.push({ type: 'negative', text: `Sector concentration critical (${Math.round(maxSectorWeight * 100)}%)` })
  } else if (maxSectorWeight > 0.35) {
    factors.push({ type: 'negative', text: `Sector concentration elevated (${Math.round(maxSectorWeight * 100)}%)` })
  } else {
    factors.push({ type: 'positive', text: 'Sector balance healthy' })
  }

  if (divScore >= 75) factors.push({ type: 'positive', text: `Good diversification (${allocation.positionCount} positions)` })
  else if (divScore < 50) factors.push({ type: 'negative', text: 'Low diversification score' })

  if (concScore >= 80 && !concentration.hasRisk) factors.push({ type: 'positive', text: 'Low position concentration' })
  else if (concentration.hasRisk) factors.push({ type: 'negative', text: 'Position concentration risk detected' })

  const score = Math.max(0, Math.min(100, Math.round(divScore * 0.40 + concScore * 0.30 + cashScore * 0.20 + sectorScore * 0.10)))
  return { score, diversification: divScore, concentration: concScore, cashReserve: cashScore, sectorBalance: sectorScore, factors }
}

function generateWarnings(sectors, positions, totalEquity, cashWeight, positionCount = 0, portfolioMature = true) {
  const warnings = []
  if (!portfolioMature) {
    warnings.push({ type: 'info', message: 'Portfolio still being constructed - rebalancing alerts activate at 5+ positions or 75% invested', severity: 'low' })
    if (cashWeight > 0.40) warnings.push({ type: 'info', message: `High cash position (${Math.round(cashWeight * 100)}%) - capital available for new positions`, severity: 'medium' })
    return warnings
  }
  for (const s of sectors) {
    if (s.weight > 0.60) warnings.push({ type: 'warning', message: `${s.sector} exposure critical (${Math.round(s.weight * 100)}%)`, severity: 'critical' })
    else if (s.weight > 0.45) warnings.push({ type: 'warning', message: `${s.sector} exposure high (${Math.round(s.weight * 100)}%)`, severity: 'high' })
  }
  for (const p of positions) {
    const weight = p.value / totalEquity
    if (weight > 0.35) warnings.push({ type: 'warning', message: `${p.ticker} represents ${Math.round(weight * 100)}% of portfolio`, severity: 'high' })
  }
  if (cashWeight < 0.05) warnings.push({ type: 'warning', message: 'Cash reserves critically low (<5%)', severity: 'high' })
  else if (cashWeight > 0.60) warnings.push({ type: 'info', message: `High cash position (${Math.round(cashWeight * 100)}%) - capital underutilized`, severity: 'medium' })
  else warnings.push({ type: 'info', message: `Cash reserves adequate at ${Math.round(cashWeight * 100)}%`, severity: 'low' })
  return warnings
}

function generateInsights(positions, sectors, cashWeight, performance, portfolioMature = true) {
  const insights = []
  if (!portfolioMature) {
    insights.push('Portfolio still being constructed - concentration insights activate at 5+ positions or 75% invested')
    return insights
  }
  if (sectors.length && sectors[0].weight > 0.40) insights.push(`Portfolio heavily concentrated in ${sectors[0].sector} (${Math.round(sectors[0].weight * 100)}%)`)
  if (performance.bestPerformer && performance.bestPerformerPct > 5) insights.push(`${performance.bestPerformer} contributes the most gains (+${performance.bestPerformerPct}%)`)
  if (performance.worstPerformer && performance.worstPerformerPct < -5) insights.push(`${performance.worstPerformer} is the biggest drag (${performance.worstPerformerPct}%)`)
  if (cashWeight > 0.40) insights.push(`${Math.round(cashWeight * 100)}% cash position - significant capital available for new opportunities`)
  else if (cashWeight < 0.10) insights.push(`Only ${Math.round(cashWeight * 100)}% cash - limited buffer for new positions`)
  if (positions.length === 1) insights.push('Single-stock portfolio - zero diversification across sectors')
  else if (positions.length <= 3) insights.push(`Only ${positions.length} positions - consider adding holdings for diversification`)
  if (sectors.length === 1 && sectors[0].sector !== 'Unknown') insights.push(`No exposure outside ${sectors[0].sector} - limited sector diversification`)
  if (!insights.length) insights.push('Portfolio is reasonably balanced across positions and sectors')
  return insights
}
