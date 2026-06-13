import { getPreferences } from '../../services/preferences.js'
import { calculatePositionSize, getVirtualCash, markToMarket, validateExecution } from '../../services/trades.js'
import { get_latest_price } from '../../services/agent.js'
import { isExecutionPriceStale, refreshQuotesBatch } from '../../services/prices.js'

function normalizeAction(signal) {
  if (signal === 'BUY') return 'BUY'
  if (signal === 'EXIT') return 'SELL'
  return null
}

function blocked(reason, details = {}) {
  return { allowed: false, reason, details }
}

function allowed(details = {}) {
  return { allowed: true, reason: null, details }
}

export class RuleEngine {
  async evaluateRecommendationExecution({ userId, recommendation, priceDoc = null, preferences = null } = {}) {
    if (!userId) return blocked('user_required')
    if (!recommendation) return blocked('recommendation_required')

    const action = normalizeAction(recommendation.signal)
    if (!action) {
      return allowed({ action: null, tradeable: false })
    }

    const prefs = preferences || await getPreferences(userId)
    const ticker = String(recommendation.ticker || '').toUpperCase()
    if (!ticker) return blocked('ticker_required')

    let currentPriceDoc = priceDoc
    if (!currentPriceDoc?.price) {
      await refreshQuotesBatch([ticker], { source: 'rule_engine' }).catch(() => {})
      currentPriceDoc = await get_latest_price(ticker)
    }

    const price = currentPriceDoc?.price
    if (!price) return blocked('price_unavailable', { action, ticker })
    if (isExecutionPriceStale(currentPriceDoc)) return blocked('stale_price', { action, ticker, updated_at: currentPriceDoc.updated_at })

    const minConfidence = prefs?.min_confidence ?? 0.7
    if (recommendation.confidence != null && Number(recommendation.confidence) < minConfidence) {
      return blocked(
        `Confidence ${(Number(recommendation.confidence) * 100).toFixed(0)}% below minimum ${(minConfidence * 100).toFixed(0)}%`,
        { action, ticker, min_confidence: minConfidence }
      )
    }

    const baseline = await validateExecution({
      userId,
      ticker,
      action,
      confidence: recommendation.confidence,
      price,
    })
    if (!baseline.allowed) return blocked(baseline.reason, { action, ticker })

    const marked = await markToMarket(userId)
    const maxSectorPct = prefs?.max_sector_exposure_pct ?? 40
    const maxPositionPct = prefs?.max_position_size_pct ?? 20
    const maxStocks = prefs?.max_stocks ?? 15
    const cashReservePct = prefs?.cash_reserve_pct ?? 10

    if (action === 'BUY') {
      const existingPosition = marked.positions.find(p => p.ticker === ticker)
      if (!existingPosition && marked.positions.length >= maxStocks) {
        return blocked(`Max ${maxStocks} positions reached`, { action, ticker, max_stocks: maxStocks })
      }

      const { virtual_cash } = await getVirtualCash(userId)
      const sizing = calculatePositionSize({
        virtual_cash,
        price,
        confidence: recommendation.confidence,
        max_position_size_pct: maxPositionPct,
        risk_tolerance: prefs?.risk_tolerance || 'moderate',
        cash_reserve_pct: cashReservePct,
      })

      if (sizing.quantity <= 0 || sizing.cost <= 0) {
        return blocked('position_size_zero', { action, ticker, sizing })
      }

      const reserveAmount = virtual_cash * (cashReservePct / 100)
      const availableCash = virtual_cash - reserveAmount
      if (sizing.cost > availableCash) {
        return blocked(`Insufficient cash after ${cashReservePct}% reserve`, { action, ticker, sizing, availableCash })
      }

      if (marked.totalEquity > 0) {
        const projectedTickerValue = (existingPosition?.value || 0) + sizing.cost
        const projectedTickerWeight = projectedTickerValue / (marked.totalEquity + sizing.cost) * 100
        if (projectedTickerWeight > maxPositionPct) {
          return blocked(`${ticker} would exceed max position size ${maxPositionPct}%`, {
            action,
            ticker,
            projectedTickerWeight,
            max_position_size_pct: maxPositionPct,
          })
        }

        const sector = existingPosition?.sector || recommendation.sector || null
        if (sector && sector !== 'Unknown') {
          const currentSectorValue = marked.positions
            .filter(p => p.sector === sector)
            .reduce((sum, p) => sum + Number(p.value || 0), 0)
          const projectedSectorWeight = (currentSectorValue + sizing.cost) / (marked.totalEquity + sizing.cost) * 100
          if (projectedSectorWeight > maxSectorPct) {
            return blocked(`${sector} sector would exceed ${maxSectorPct}% exposure`, {
              action,
              ticker,
              sector,
              projectedSectorWeight,
              max_sector_exposure_pct: maxSectorPct,
            })
          }
        }
      }

      return allowed({ action, ticker, price, sizing, tradeable: true })
    }

    const position = marked.positions.find(p => p.ticker === ticker)
    const quantity = position ? Math.floor(Number(position.quantity)) : 0
    if (quantity <= 0) return blocked(`No ${ticker} position to exit`, { action, ticker })

    return allowed({
      action,
      ticker,
      price,
      sizing: { quantity, note: 'full position exit' },
      tradeable: true,
    })
  }
}

export const ruleEngine = new RuleEngine()
